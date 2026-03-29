import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/guard';
import { config } from '$lib/server/config';
import { upsertSession } from '$lib/server/sessions/store';
import { streamSimple } from '@mariozechner/pi-ai';
import type { Model, AssistantMessage } from '@mariozechner/pi-ai';

export const POST: RequestHandler = async (event) => {
	const pubkey = requireAuth(event);
	const body = await event.request.json().catch(() => null);

	const sessionId = body?.sessionId as string | undefined;
	const modelSpec = body?.model as any;
	const context = body?.context as { systemPrompt?: string; messages?: any[]; tools?: any[] } | undefined;
	const reasoning = body?.reasoning as string | undefined;
	const title = body?.title as string | undefined;

	if (!modelSpec?.id || !context) {
		return json({ error: 'BadRequest', message: 'Missing model or context' }, { status: 400 });
	}

	const baseUrl = config.lmStudio.baseUrl.replace(/\/+$/, '');
	const model: Model<'openai-completions'> = {
		id: modelSpec.id,
		name: modelSpec.name || modelSpec.id,
		api: 'openai-completions',
		provider: modelSpec.provider || 'creampi-lmstudio',
		baseUrl: `${baseUrl}/v1`,
		reasoning: modelSpec.reasoning ?? false,
		input: modelSpec.input ?? ['text'],
		cost: modelSpec.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: modelSpec.contextWindow ?? 8192,
		maxTokens: modelSpec.maxTokens ?? 4096,
	};

	const llmContext = {
		systemPrompt: context.systemPrompt || '',
		messages: context.messages || [],
		tools: context.tools || [],
	};

	const encoder = new TextEncoder();
	let sseController: ReadableStreamDefaultController<Uint8Array> | null = null;
	let browserDisconnected = false;

	function writeSse(eventType: string, data: any) {
		if (browserDisconnected || !sseController) return;
		try {
			sseController.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`));
		} catch {
			browserDisconnected = true;
		}
	}

	function closeSse() {
		if (browserDisconnected || !sseController) return;
		try {
			sseController.close();
		} catch {
			// already closed
		}
	}

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			sseController = controller;
			runInference();
		},
		cancel() {
			browserDisconnected = true;
		},
	});

	async function runInference() {
		let finalMessage: AssistantMessage | null = null;
		try {
			const response = streamSimple(model, llmContext, {
				reasoning: reasoning as any,
				apiKey: config.lmStudio.apiKey || undefined,
			});

			for await (const evt of response) {
				writeSse(evt.type, evt);
				if (evt.type === 'done') {
					finalMessage = evt.message;
				} else if (evt.type === 'error') {
					finalMessage = evt.error;
				}
			}
		} catch (err: any) {
			const errorEvt = {
				type: 'error' as const,
				reason: 'error' as const,
				error: {
					role: 'assistant',
					content: [{ type: 'text', text: '' }],
					api: model.api,
					provider: model.provider,
					model: model.id,
					usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
					stopReason: 'error',
					errorMessage: err?.message || String(err),
					timestamp: Date.now(),
				} as AssistantMessage,
			};
			finalMessage = errorEvt.error;
			writeSse('error', errorEvt);
		} finally {
			closeSse();

			if (sessionId && finalMessage) {
				try {
					const allMessages = [...(context!.messages || []), finalMessage];
					const now = new Date().toISOString();
					upsertSession(pubkey, {
						id: sessionId,
						title: title || 'Chat',
						messages: allMessages,
						thinkingLevel: reasoning || 'off',
						agentKind: 'chat',
					}, {
						lastModified: now,
						messageCount: allMessages.length,
						modelId: model.id,
						preview: title || 'Chat',
						agentKind: 'chat',
					});
				} catch (e) {
					console.error('Failed to auto-save session after inference:', e);
				}
			}
		}
	}

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no',
		},
	});
};

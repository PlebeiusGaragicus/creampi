import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentState } from "@mariozechner/pi-web-ui";
import {
	ChatPanel,
	createJavaScriptReplTool,
	defaultConvertToLlm,
} from "@mariozechner/pi-web-ui";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import type { Model, AssistantMessageEvent, SimpleStreamOptions, Context } from "@mariozechner/pi-ai";
import { replaceState } from "$app/navigation";
import { agentStore, chatPanelStore, isStreaming } from "../stores/agent";
import { currentSessionId, currentTitle, sessionList } from "../stores/sessions";
import { selectedModel } from "../stores/settings";
import { get } from "svelte/store";
import { emitPromptEvent, emitErrorEvent } from "../api/events";
import { Span } from "../api/tracing";
import { saveSessionRemote, discoverModels as fetchServerModels } from "$lib/api/client";
import { getToken } from "$lib/stores/auth";

let agentUnsubscribe: (() => void) | undefined;

/**
 * Rewrite non-ESM CDN imports to ESM-compatible URLs.
 * The REPL sandbox uses <script type="module">, so all imports must be ESM.
 * LLMs commonly generate UMD/CJS CDN URLs from training data which fail at runtime.
 */
function fixCdnImports(code: string): string {
	return code
		.replace(
			/(['"])https:\/\/cdn\.jsdelivr\.net\/npm\/([^/'"]+)\/dist\/[^'"]*\.(?:umd|cjs)(?:\.min)?\.(?:js|mjs)['"]/g,
			(_match, quote, pkg) => `${quote}https://esm.run/${pkg}${quote}`,
		)
		.replace(
			/(['"])https:\/\/unpkg\.com\/([^/'"]+)\/dist\/[^'"]*\.(?:umd|cjs)(?:\.min)?\.(?:js|mjs)['"]/g,
			(_match, quote, pkg) => `${quote}https://esm.run/${pkg}${quote}`,
		);
}

export function getOrCreateChatPanel(): ChatPanel {
	const existing = get(chatPanelStore);
	if (existing) return existing;
	const panel = new ChatPanel();
	chatPanelStore.set(panel);
	return panel;
}

function generateTitle(messages: any[]): string {
	const first = messages.find((m: any) => m.role === "user" || m.role === "user-with-attachments");
	if (!first || (first.role !== "user" && first.role !== "user-with-attachments")) return "";
	let text = typeof first.content === "string"
		? first.content
		: (first.content as any[]).filter((c: any) => c.type === "text").map((c: any) => c.text || "").join(" ");
	text = text.trim();
	if (!text) return "";
	const end = text.search(/[.!?]/);
	if (end > 0 && end <= 50) return text.substring(0, end + 1);
	return text.length <= 50 ? text : `${text.substring(0, 47)}...`;
}

function hasUserMessage(messages: any[]): boolean {
	return messages.some((m: any) => m.role === "user" || m.role === "user-with-attachments");
}

function shouldSaveSession(messages: any[]): boolean {
	return hasUserMessage(messages) &&
		messages.some((m: any) => m.role === "assistant");
}

function persistSelectedModel(model: any) {
	if (!model) return;
	selectedModel.set({
		id: model.id,
		name: model.name || model.id,
		provider: model.provider,
		baseUrl: model.baseUrl || "",
		contextWindow: model.contextWindow || 8192,
		maxTokens: model.maxTokens || 4096,
	});
}

function createServerStreamFn() {
	return (model: Model<any>, context: Context, options?: SimpleStreamOptions) => {
		const stream = createAssistantMessageEventStream();

		const sessionId = get(currentSessionId);
		const title = get(currentTitle) || "Chat";
		const token = getToken();

		const body = JSON.stringify({
			sessionId,
			title,
			model: {
				id: model.id,
				name: model.name,
				provider: model.provider,
				reasoning: model.reasoning,
				input: model.input,
				cost: model.cost,
				contextWindow: model.contextWindow,
				maxTokens: model.maxTokens,
			},
			context: {
				systemPrompt: context.systemPrompt,
				messages: context.messages,
				tools: context.tools,
			},
			reasoning: options?.reasoning,
		});

		const headers: Record<string, string> = { 'Content-Type': 'application/json' };
		if (token) headers['Authorization'] = `Bearer ${token}`;

		const abortController = new AbortController();
		if (options?.signal) {
			options.signal.addEventListener('abort', () => abortController.abort());
		}

		(async () => {
			try {
				const res = await fetch('/api/chat/inference', {
					method: 'POST',
					headers,
					body,
					signal: abortController.signal,
				});

				if (!res.ok || !res.body) {
					const errText = await res.text().catch(() => `HTTP ${res.status}`);
					stream.push({
						type: 'error',
						reason: 'error',
						error: {
							role: 'assistant',
							content: [{ type: 'text', text: '' }],
							api: model.api,
							provider: model.provider,
							model: model.id,
							usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
							stopReason: 'error',
							errorMessage: `Server error: ${errText}`,
							timestamp: Date.now(),
						},
					} as AssistantMessageEvent);
					return;
				}

				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let buffer = '';
				let currentEvent = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() ?? '';

					for (const line of lines) {
						if (line.startsWith('event: ')) {
							currentEvent = line.slice(7).trim();
						} else if (line.startsWith('data: ') && currentEvent) {
							try {
								const data = JSON.parse(line.slice(6));
								stream.push(data as AssistantMessageEvent);
							} catch {
								// skip malformed
							}
							currentEvent = '';
						}
					}
				}
			} catch (err: any) {
				if (err?.name === 'AbortError') {
					stream.end();
					return;
				}
				stream.push({
					type: 'error',
					reason: 'error',
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
					},
				} as AssistantMessageEvent);
			}
		})();

		return stream;
	};
}

async function resolveModel(): Promise<Model<'openai-completions'> | undefined> {
	const saved = get(selectedModel);
	if (saved) {
		return {
			id: saved.id,
			name: saved.name,
			api: "openai-completions" as const,
			provider: saved.provider || "creampi-lmstudio",
			baseUrl: saved.baseUrl || "",
			reasoning: false,
			input: ["text" as const],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: saved.contextWindow || 8192,
			maxTokens: saved.maxTokens || 4096,
		};
	}

	try {
		const { models, defaultModel } = await fetchServerModels();
		if (models.length > 0) {
			const pick = (defaultModel ? models.find((m: any) => m.id === defaultModel) : null) || models[0];
			const model: Model<'openai-completions'> = {
				id: pick.id,
				name: pick.name || pick.id,
				api: "openai-completions",
				provider: "creampi-lmstudio",
				baseUrl: "",
				reasoning: false,
				input: ["text"],
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				contextWindow: pick.contextWindow || 8192,
				maxTokens: pick.maxTokens || 4096,
			};
			persistSelectedModel(model);
			return model;
		}
	} catch {
		// server unreachable
	}
	return undefined;
}

export async function createAgent(
	chatPanel: ChatPanel,
	storage: any,
	initialState?: Partial<AgentState>,
) {
	if (agentUnsubscribe) agentUnsubscribe();

	const model = await resolveModel();

	const agent = new Agent({
		initialState: initialState
			? { ...initialState, model: initialState.model || model }
			: {
				systemPrompt: "You are a helpful AI assistant.",
				model,
				thinkingLevel: "off",
				messages: [],
				tools: [],
			},
		convertToLlm: defaultConvertToLlm,
		streamFn: createServerStreamFn(),
	});
	persistSelectedModel(agent.state.model);

	agentStore.set(agent);

	let promptSpan: Span | null = null;

	agentUnsubscribe = agent.subscribe((event: any) => {
		if (event.type === "agent_start") {
			isStreaming.set(true);
			promptSpan = new Span("prompt");
		}

		if (
			event.type === "message_end" &&
			(event.message?.role === "user" || event.message?.role === "user-with-attachments") &&
			!get(currentSessionId)
		) {
			const messages = agent.state.messages;
			const newId = crypto.randomUUID();
			const title = generateTitle(messages) || "New chat";
			currentSessionId.set(newId);
			currentTitle.set(title);
			rememberLastSession(newId);
			replaceState(`/chat/${newId}`, {});

			const now = new Date().toISOString();
			sessionList.update((list) => [{
				id: newId,
				title,
				createdAt: now,
				lastModified: now,
				messageCount: messages.length,
				preview: title,
				modelId: agent.state.model?.id || null,
				agentKind: "chat" as const,
			}, ...list]);
		}

		if (event.type === "agent_end") {
			isStreaming.set(false);
			if (promptSpan) {
				const result = promptSpan.end();
				const sid = get(currentSessionId);
				if (sid) emitPromptEvent(sid, result.durationMs, 0, 0);
				promptSpan = null;
			}
		}

		if (event.type === "message_end" || event.type === "agent_end") {
			const messages = agent.state.messages;
			const sid = get(currentSessionId);
			if (sid && shouldSaveSession(messages)) {
				const t = get(currentTitle) || "New chat";
				rememberLastSession(sid);
				saveSession(agent, storage, sid, t, messages).catch((err) => {
					emitErrorEvent("session_save", String(err), sid);
				});
			}
		}
	});

	const esmImportGuidance = `

## CRITICAL: ESM Imports Only
The sandbox runs inside <script type="module">. All imports MUST be ES modules.
- Use \`https://esm.run/package-name\` (preferred) or \`https://esm.sh/package-name\`
- NEVER use UMD/CJS builds (e.g. \`dist/package.umd.min.js\`) — they will fail with a SyntaxError`;

	await chatPanel.setAgent(agent, {
		toolsFactory: (_agent, _agentInterface, _artifactsPanel, runtimeProvidersFactory) => {
			const replTool = createJavaScriptReplTool();
			replTool.runtimeProvidersFactory = runtimeProvidersFactory;

			const origDescription = replTool.description;
			Object.defineProperty(replTool, 'description', {
				get() { return origDescription + esmImportGuidance; },
			});

			const origExecute = replTool.execute.bind(replTool);
			replTool.execute = async (toolCallId: string, args: any, signal?: AbortSignal) => {
				return origExecute(toolCallId, { ...args, code: fixCdnImports(args.code) }, signal);
			};
			return [replTool];
		},
	});

	chatPanel.agentInterface!.enableModelSelector = true;
	chatPanel.agentInterface!.enableThinkingSelector = true;
	chatPanel.agentInterface!.onModelSelect = async () => {
		const { ModelSelector } = await import("@mariozechner/pi-web-ui");
		const { LMSTUDIO_PROVIDER_NAME } = await import("./storage");
		ModelSelector.open(
			agent.state.model,
			(nextModel) => {
				agent.setModel(nextModel);
				persistSelectedModel(nextModel);
			},
			[LMSTUDIO_PROVIDER_NAME],
		);
	};

	return agent;
}

const LAST_SESSION_KEY = "creampi_last_session_id";

export function rememberLastSession(id: string) {
	try { sessionStorage.setItem(LAST_SESSION_KEY, id); } catch {}
}

export function getLastSessionId(): string | null {
	try { return sessionStorage.getItem(LAST_SESSION_KEY); } catch { return null; }
}

export function clearLastSession() {
	try { sessionStorage.removeItem(LAST_SESSION_KEY); } catch {}
}

export async function startNewChat() {
	const panel = get(chatPanelStore);
	if (!panel) return;

	currentSessionId.set(undefined);
	currentTitle.set('');
	clearLastSession();

	const { initStorage } = await import("./storage");
	const storage = await initStorage();
	await createAgent(panel, storage);
}

async function saveSession(agent: Agent, storage: any, sessionId: string, title: string, messages: any[]) {
	if (!shouldSaveSession(messages)) return;
	const state = agent.state;
	const now = new Date().toISOString();

	const existing = await storage.sessions.get(sessionId);
	const createdAt = existing?.createdAt ?? now;

	await storage.sessions.save(
		{
			id: sessionId,
			title,
			model: state.model!,
			thinkingLevel: state.thinkingLevel,
			messages: state.messages,
			createdAt,
			lastModified: now,
		},
		{
			id: sessionId,
			title,
			createdAt,
			lastModified: now,
			messageCount: state.messages.length,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			modelId: state.model?.id || null,
			thinkingLevel: state.thinkingLevel,
			preview: title,
		},
	);

	await saveSessionRemote(
		{
			id: sessionId,
			title,
			model: state.model!,
			thinkingLevel: state.thinkingLevel,
			messages: state.messages,
			agentKind: "chat",
		},
		{
			id: sessionId,
			title,
			createdAt,
			lastModified: now,
			messageCount: state.messages.length,
			modelId: state.model?.id || null,
			thinkingLevel: state.thinkingLevel,
			preview: title,
			agentKind: "chat",
		},
	);
}

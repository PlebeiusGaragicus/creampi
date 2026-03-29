import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/guard';
import { getComputerRuntime } from '$lib/server/runtime/factory';

export const POST: RequestHandler = async (event) => {
	const pubkey = requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const sessionId = body?.sessionId as string | undefined;
	const message = body?.message as string | undefined;
	const model = body?.model as string | undefined;
	const provider = body?.provider as string | undefined;
	const agentKind = (body?.agentKind as 'chat' | 'computer' | undefined) ?? 'computer';

	if (!sessionId || !message) {
		return json({ error: 'BadRequest', message: 'Missing sessionId or message' }, { status: 400 });
	}

	if (agentKind !== 'computer') {
		return json({ error: 'BadRequest', message: 'Chat mode uses browser-side pi-agent-core and does not stream via server' }, { status: 400 });
	}

	const runtime = getComputerRuntime();
	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const encoder = new TextEncoder();
			const sendEvent = (type: string, data: Record<string, unknown>) => {
				controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
			};

			runtime
				.executeTurn({ sessionId, message, model, provider, pubkey, agentKind }, (evt) => {
					sendEvent(evt.type, evt.data);
				})
				.then(() => {
					controller.close();
				})
				.catch((err) => {
					sendEvent('error', { message: err instanceof Error ? err.message : String(err) });
					controller.close();
				});
		},
		cancel() {
			runtime.abortTurn(sessionId);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};

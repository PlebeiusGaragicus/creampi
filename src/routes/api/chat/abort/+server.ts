import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/guard';
import { getComputerRuntime } from '$lib/server/runtime/factory';

export const POST: RequestHandler = async (event) => {
	requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const sessionId = body?.sessionId as string | undefined;
	if (!sessionId) {
		return json({ error: 'BadRequest', message: 'Missing sessionId' }, { status: 400 });
	}
	getComputerRuntime().abortTurn(sessionId);
	return json({ ok: true });
};

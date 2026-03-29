import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/guard';
import { listSessions, upsertSession } from '$lib/server/sessions/store';

export const GET: RequestHandler = async (event) => {
	const pubkey = requireAuth(event);
	return json(listSessions(pubkey));
};

export const POST: RequestHandler = async (event) => {
	const pubkey = requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const session = body?.session;
	const metadata = body?.metadata ?? {};
	if (!session?.id) {
		return json({ error: 'BadRequest', message: 'Missing session.id' }, { status: 400 });
	}
	upsertSession(pubkey, session, metadata);
	return json({ ok: true });
};

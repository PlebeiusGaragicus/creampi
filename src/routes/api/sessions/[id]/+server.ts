import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/guard';
import { deleteSession, getSession } from '$lib/server/sessions/store';

export const GET: RequestHandler = async (event) => {
	const pubkey = requireAuth(event);
	const id = event.params.id;
	if (!id) return json({ error: 'BadRequest', message: 'Missing session id' }, { status: 400 });
	const row = getSession(id, pubkey);
	if (!row) return json({ error: 'NotFound', message: 'Session not found' }, { status: 404 });
	return json({
		id: row.id,
		title: row.title,
		modelId: row.model_id,
		thinkingLevel: row.thinking_level,
		messages: JSON.parse(row.messages ?? '[]'),
		createdAt: row.created_at,
		lastModified: row.last_modified,
		messageCount: row.message_count,
		preview: row.preview,
		agentKind: row.agent_kind
	});
};

export const DELETE: RequestHandler = async (event) => {
	const pubkey = requireAuth(event);
	const id = event.params.id;
	if (!id) return json({ error: 'BadRequest', message: 'Missing session id' }, { status: 400 });
	const deleted = deleteSession(id, pubkey);
	if (!deleted) return json({ error: 'NotFound', message: 'Session not found' }, { status: 404 });
	return json({ ok: true });
};

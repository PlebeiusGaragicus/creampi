import { json, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth/guard';
import { getDb } from '$lib/server/db';

export const POST: RequestHandler = async (event) => {
	const pubkey = requireAuth(event);
	const body = await event.request.json().catch(() => ({}));
	const events = body?.events;
	if (!Array.isArray(events)) {
		return json({ error: 'BadRequest', message: 'Expected events array' }, { status: 400 });
	}

	const db = getDb();
	const insert = db.prepare(
		'INSERT INTO telemetry_events (type, timestamp, correlation_id, owner_pubkey, data) VALUES (?, ?, ?, ?, ?)'
	);
	const tx = db.transaction((batch: any[]) => {
		for (const item of batch) {
			insert.run(item.type ?? 'unknown', item.timestamp ?? Date.now(), item.correlationId ?? null, pubkey, JSON.stringify(item.data ?? {}));
		}
	});
	tx(events);

	return json({ ok: true, accepted: events.length });
};

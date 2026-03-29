import { json, type RequestHandler } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '$lib/server/config';
import { requireAuth } from '$lib/server/auth/guard';
import { getSession } from '$lib/server/sessions/store';
import { listFiles, insertFile, deleteFile } from '$lib/server/files/store';

const uploadsDir = join(config.dataDir, 'uploads');
mkdirSync(uploadsDir, { recursive: true });

export const GET: RequestHandler = async (event) => {
	const pubkey = requireAuth(event);
	const sessionId = event.params.id;
	if (!sessionId) return json({ error: 'BadRequest', message: 'Missing session id' }, { status: 400 });
	const session = getSession(sessionId, pubkey);
	if (!session) return json({ error: 'NotFound', message: 'Session not found' }, { status: 404 });
	return json(listFiles(sessionId));
};

export const POST: RequestHandler = async (event) => {
	const pubkey = requireAuth(event);
	const sessionId = event.params.id;
	if (!sessionId) return json({ error: 'BadRequest', message: 'Missing session id' }, { status: 400 });
	const session = getSession(sessionId, pubkey);
	if (!session) return json({ error: 'NotFound', message: 'Session not found' }, { status: 404 });

	const form = await event.request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) {
		return json({ error: 'BadRequest', message: 'No file uploaded' }, { status: 400 });
	}

	const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
	const filename = ext ? `${randomUUID()}.${ext}` : randomUUID();
	const storagePath = join(uploadsDir, filename);
	const buffer = Buffer.from(await file.arrayBuffer());
	writeFileSync(storagePath, buffer);

	const meta = insertFile(randomUUID(), sessionId, file.name, file.size, file.type || 'application/octet-stream', storagePath);
	return json(meta);
};

export const DELETE: RequestHandler = async (event) => {
	requireAuth(event);
	const sessionId = event.params.id;
	const fileId = event.url.searchParams.get('fileId');
	if (!sessionId || !fileId) {
		return json({ error: 'BadRequest', message: 'Missing session id or fileId' }, { status: 400 });
	}
	const deleted = deleteFile(fileId, sessionId);
	if (!deleted) return json({ error: 'NotFound', message: 'File not found' }, { status: 404 });
	return json({ ok: true });
};

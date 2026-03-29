import { getDb } from "../db";
import { unlinkSync } from "node:fs";

export interface FileRow {
	id: string;
	session_id: string;
	name: string;
	size: number;
	mime_type: string;
	storage_path: string;
	created_at: string;
}

export interface FileMeta {
	id: string;
	name: string;
	size: number;
	mimeType: string;
	createdAt: string;
}

export function listFiles(sessionId: string): FileMeta[] {
	const db = getDb();
	const rows = db
		.prepare("SELECT id, name, size, mime_type, created_at FROM session_files WHERE session_id = ?")
		.all(sessionId) as FileRow[];

	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		size: r.size,
		mimeType: r.mime_type,
		createdAt: r.created_at,
	}));
}

export function insertFile(
	id: string,
	sessionId: string,
	name: string,
	size: number,
	mimeType: string,
	storagePath: string,
): FileMeta {
	const db = getDb();
	const now = new Date().toISOString();

	db.prepare(
		`INSERT INTO session_files (id, session_id, name, size, mime_type, storage_path, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(id, sessionId, name, size, mimeType, storagePath, now);

	return { id, name, size, mimeType, createdAt: now };
}

export function deleteFile(fileId: string, sessionId: string): boolean {
	const db = getDb();
	const row = db
		.prepare("SELECT storage_path FROM session_files WHERE id = ? AND session_id = ?")
		.get(fileId, sessionId) as { storage_path: string } | undefined;

	if (!row) return false;

	db.prepare("DELETE FROM session_files WHERE id = ? AND session_id = ?").run(
		fileId,
		sessionId,
	);

	try {
		unlinkSync(row.storage_path);
	} catch {
		// File may already be gone
	}

	return true;
}

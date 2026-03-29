import { getDb } from '../db';
import type { AgentKind, SessionMeta } from '$lib/shared/types';

export interface SessionRow {
	id: string;
	owner_pubkey: string;
	title: string;
	model_id: string | null;
	thinking_level: string;
	messages: string;
	created_at: string;
	last_modified: string;
	message_count: number;
	preview: string;
	agent_kind: AgentKind;
}

export function listSessions(pubkey: string): SessionMeta[] {
	const db = getDb();
	const rows = db
		.prepare(
			`SELECT id, title, created_at, last_modified, message_count, model_id, preview, agent_kind
			 FROM sessions WHERE owner_pubkey = ? ORDER BY last_modified DESC`
		)
		.all(pubkey) as SessionRow[];

	return rows.map((r) => ({
		id: r.id,
		title: r.title,
		createdAt: r.created_at,
		lastModified: r.last_modified,
		messageCount: r.message_count,
		modelId: r.model_id,
		preview: r.preview,
		agentKind: r.agent_kind ?? 'chat'
	}));
}

export function getSession(sessionId: string, pubkey: string): SessionRow | null {
	const db = getDb();
	const row = db
		.prepare('SELECT * FROM sessions WHERE id = ? AND owner_pubkey = ?')
		.get(sessionId, pubkey) as SessionRow | undefined;
	return row ?? null;
}

export function upsertSession(
	pubkey: string,
	session: {
		id: string;
		title: string;
		model?: any;
		thinkingLevel?: string;
		messages?: any[];
		agentKind?: AgentKind;
	},
	metadata: {
		createdAt?: string;
		lastModified?: string;
		messageCount?: number;
		modelId?: string | null;
		preview?: string;
		agentKind?: AgentKind;
	}
): void {
	const db = getDb();
	const now = new Date().toISOString();
	const agentKind = metadata.agentKind ?? session.agentKind ?? 'chat';

	db.prepare(
		`INSERT INTO sessions (id, owner_pubkey, title, model_id, thinking_level, messages, created_at, last_modified, message_count, preview, agent_kind)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			model_id = excluded.model_id,
			thinking_level = excluded.thinking_level,
			messages = excluded.messages,
			last_modified = excluded.last_modified,
			message_count = excluded.message_count,
			preview = excluded.preview,
			agent_kind = excluded.agent_kind`
	).run(
		session.id,
		pubkey,
		session.title || '',
		metadata.modelId ?? session.model?.id ?? null,
		session.thinkingLevel ?? 'off',
		JSON.stringify(session.messages ?? []),
		metadata.createdAt ?? now,
		metadata.lastModified ?? now,
		metadata.messageCount ?? 0,
		metadata.preview ?? '',
		agentKind
	);
}

export function deleteSession(sessionId: string, pubkey: string): boolean {
	const db = getDb();
	const result = db
		.prepare('DELETE FROM sessions WHERE id = ? AND owner_pubkey = ?')
		.run(sessionId, pubkey);
	return result.changes > 0;
}

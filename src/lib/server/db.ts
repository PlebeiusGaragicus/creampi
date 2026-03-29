import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config';

let db: Database.Database | null = null;

function ensureMigrations(database: Database.Database): void {
	database.exec(`
		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			owner_pubkey TEXT NOT NULL,
			title TEXT NOT NULL DEFAULT '',
			model_id TEXT,
			thinking_level TEXT DEFAULT 'off',
			messages TEXT NOT NULL DEFAULT '[]',
			created_at TEXT NOT NULL,
			last_modified TEXT NOT NULL,
			message_count INTEGER DEFAULT 0,
			preview TEXT DEFAULT '',
			agent_kind TEXT NOT NULL DEFAULT 'chat'
		);

		CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_pubkey);

		CREATE TABLE IF NOT EXISTS session_files (
			id TEXT PRIMARY KEY,
			session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			size INTEGER NOT NULL,
			mime_type TEXT NOT NULL,
			storage_path TEXT NOT NULL,
			created_at TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_files_session ON session_files(session_id);

		CREATE TABLE IF NOT EXISTS telemetry_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			type TEXT NOT NULL,
			timestamp INTEGER NOT NULL,
			correlation_id TEXT,
			owner_pubkey TEXT,
			data TEXT NOT NULL DEFAULT '{}'
		);

		CREATE TABLE IF NOT EXISTS auth_tokens (
			token TEXT PRIMARY KEY,
			pubkey TEXT NOT NULL,
			expires_at INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_tokens_pubkey ON auth_tokens(pubkey);
	`);

	try {
		database.exec("ALTER TABLE sessions ADD COLUMN agent_kind TEXT NOT NULL DEFAULT 'chat'");
	} catch {
		// already migrated
	}
}

export function getDb(): Database.Database {
	if (db) return db;
	mkdirSync(config.dataDir, { recursive: true });
	const dbPath = join(config.dataDir, 'creampi.db');
	db = new Database(dbPath);
	db.pragma('journal_mode = WAL');
	db.pragma('foreign_keys = ON');
	ensureMigrations(db);
	return db;
}

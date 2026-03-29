import { randomBytes } from 'node:crypto';
import { getDb } from '../db';

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

export function issueToken(pubkey: string): { token: string; expiresIn: number } {
	const db = getDb();
	const token = randomBytes(48).toString('hex');
	const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
	db.prepare('INSERT INTO auth_tokens (token, pubkey, expires_at) VALUES (?, ?, ?)').run(token, pubkey, expiresAt);
	return { token, expiresIn: TOKEN_EXPIRY_MS };
}

export function resolveToken(token: string): string | null {
	const db = getDb();
	const row = db.prepare('SELECT pubkey, expires_at FROM auth_tokens WHERE token = ?').get(token) as { pubkey: string; expires_at: number } | undefined;
	if (!row) return null;
	if (row.expires_at < Date.now()) {
		db.prepare('DELETE FROM auth_tokens WHERE token = ?').run(token);
		return null;
	}
	return row.pubkey;
}

export function cleanExpiredTokens(): void {
	getDb().prepare('DELETE FROM auth_tokens WHERE expires_at < ?').run(Date.now());
}

export function revokeToken(token: string): void {
	getDb().prepare('DELETE FROM auth_tokens WHERE token = ?').run(token);
}

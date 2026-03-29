import { error, type RequestEvent } from '@sveltejs/kit';
import { resolveToken } from './tokens';

export function requireAuth(event: RequestEvent): string {
	const header = event.request.headers.get('authorization') ?? '';
	if (!header.startsWith('Bearer ')) throw error(401, 'Missing Bearer token');
	const token = header.slice(7);
	const pubkey = resolveToken(token);
	if (!pubkey) throw error(401, 'Invalid or expired token');
	event.locals.pubkey = pubkey;
	return pubkey;
}

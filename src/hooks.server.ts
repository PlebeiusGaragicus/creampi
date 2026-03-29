import type { Handle } from '@sveltejs/kit';
import { cleanExpiredTokens } from '$lib/server/auth/tokens';
import { getDb } from '$lib/server/db';

let initialized = false;

export const handle: Handle = async ({ event, resolve }) => {
	if (!initialized) {
		getDb();
		cleanExpiredTokens();
		initialized = true;
	}
	return resolve(event);
};

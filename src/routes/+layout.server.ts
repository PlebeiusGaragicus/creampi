import { redirect } from '@sveltejs/kit';
import { resolveToken } from '$lib/server/auth/tokens';
import type { LayoutServerLoad } from './$types';

const PROTECTED_PREFIXES = ['/chat', '/computer', '/settings'];

function isProtectedPath(pathname: string): boolean {
	return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const load: LayoutServerLoad = async ({ cookies, url, locals }) => {
	const pathname = url.pathname;
	const token = cookies.get('creampi_token');
	const pubkey = token ? resolveToken(token) : null;
	const authenticated = !!pubkey;

	if (pubkey) {
		locals.pubkey = pubkey;
	}

	if (isProtectedPath(pathname) && !authenticated) {
		throw redirect(303, `/login?next=${encodeURIComponent(pathname)}`);
	}

	if (pathname === '/') {
		throw redirect(303, authenticated ? '/chat' : '/login');
	}

	if (pathname === '/login' && authenticated) {
		throw redirect(303, '/chat');
	}

	return { authenticated, pubkey };
};

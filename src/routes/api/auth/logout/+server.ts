import { json, type RequestHandler } from '@sveltejs/kit';
import { revokeToken } from '$lib/server/auth/tokens';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const header = request.headers.get('authorization') ?? '';
	if (header.startsWith('Bearer ')) {
		const token = header.slice(7).trim();
		if (token) {
			revokeToken(token);
		}
	}

	const cookieToken = cookies.get('creampi_token');
	if (cookieToken) {
		revokeToken(cookieToken);
	}

	cookies.delete('creampi_token', { path: '/' });
	return json({ ok: true });
};

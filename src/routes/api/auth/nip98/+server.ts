import { json, type RequestHandler } from '@sveltejs/kit';
import { parseNip98Header, validateNip98Event } from '$lib/server/auth/nip98';
import { issueToken } from '$lib/server/auth/tokens';

interface RateLimitDecision {
	limited: boolean;
	retryAfterSeconds?: number;
}

function errorResponse(status: number, code: string, message: string) {
	return json({ ok: false, error: { code, message } }, { status });
}

function checkAuthRateLimit(_clientAddress: string): RateLimitDecision {
	// Placeholder hook for auth rate limiting or IP reputation checks.
	// Keep permissive behavior for now; wire to Redis/fail2ban integration later.
	return { limited: false };
}

export const POST: RequestHandler = async ({ request, url, cookies, getClientAddress }) => {
	const clientAddress = getClientAddress();
	const rateLimit = checkAuthRateLimit(clientAddress);
	if (rateLimit.limited) {
		return json(
			{
				ok: false,
				error: {
					code: 'rate_limited',
					message: 'Too many authentication attempts. Please try again shortly.'
				}
			},
			{
				status: 429,
				headers: rateLimit.retryAfterSeconds ? { 'Retry-After': String(rateLimit.retryAfterSeconds) } : undefined
			}
		);
	}

	const authHeader = request.headers.get('authorization') ?? '';
	const event = parseNip98Header(authHeader);
	if (!event) {
		return errorResponse(401, 'malformed_header', 'Missing or malformed Nostr auth header');
	}

	const result = validateNip98Event(event, url.toString(), 'POST');
	if (!result.valid) {
		return errorResponse(401, result.code, result.error);
	}

	const body = await request.json().catch(() => ({}));
	if (body.pubkey && body.pubkey !== result.pubkey) {
		return errorResponse(400, 'pubkey_mismatch', 'Pubkey mismatch between body and event');
	}

	const { token, expiresIn } = issueToken(result.pubkey);
	cookies.set('creampi_token', token, {
		path: '/',
		httpOnly: false,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: Math.floor(expiresIn / 1000)
	});

	return json({
		ok: true,
		token,
		pubkey: result.pubkey,
		expiresIn
	});
};

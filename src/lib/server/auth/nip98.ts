import { verifyEvent } from 'nostr-tools';

const MAX_EVENT_AGE_SECONDS = 120;

export function parseNip98Header(authHeader: string): object | null {
	if (!authHeader.startsWith('Nostr ')) return null;
	const encoded = authHeader.slice(6).trim();
	try {
		const json = Buffer.from(encoded, 'base64').toString('utf8');
		return JSON.parse(json);
	} catch {
		return null;
	}
}

export function validateNip98Event(
	event: any,
	expectedUrl: string,
	expectedMethod: string
):
	| { valid: true; pubkey: string }
	| {
			valid: false;
			code:
				| 'invalid_event'
				| 'wrong_kind'
				| 'stale_event'
				| 'url_mismatch'
				| 'method_mismatch'
				| 'signature_failed'
				| 'signature_error';
			error: string;
	  } {
	if (!event || typeof event !== 'object') {
		return { valid: false, code: 'invalid_event', error: 'Invalid event object' };
	}

	if (event.kind !== 27235) {
		return { valid: false, code: 'wrong_kind', error: `Expected kind 27235, got ${event.kind}` };
	}

	const now = Math.floor(Date.now() / 1000);
	if (Math.abs(now - event.created_at) > MAX_EVENT_AGE_SECONDS) {
		return { valid: false, code: 'stale_event', error: 'Event timestamp out of range' };
	}

	const tags = event.tags ?? [];
	const uTag = tags.find((t: string[]) => t[0] === 'u');
	const methodTag = tags.find((t: string[]) => t[0] === 'method');

	if (!uTag || uTag[1] !== expectedUrl) {
		return { valid: false, code: 'url_mismatch', error: 'URL tag mismatch' };
	}
	if (!methodTag || methodTag[1].toUpperCase() !== expectedMethod.toUpperCase()) {
		return { valid: false, code: 'method_mismatch', error: 'Method tag mismatch' };
	}

	try {
		if (!verifyEvent(event)) {
			return { valid: false, code: 'signature_failed', error: 'Signature verification failed' };
		}
	} catch (err) {
		return { valid: false, code: 'signature_error', error: `Signature check error: ${err}` };
	}

	return { valid: true, pubkey: event.pubkey };
}

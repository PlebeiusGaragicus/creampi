import { clearAuth, getToken, setAuth } from '$lib/stores/auth';

export function hasNostrExtension(): boolean {
	return typeof window !== 'undefined' && !!window.nostr;
}

export type NostrExtensionStatus = 'available' | 'missing';

export function getNostrExtensionStatus(): NostrExtensionStatus {
	return hasNostrExtension() ? 'available' : 'missing';
}

export interface LoginResult {
	ok: boolean;
	pubkey?: string;
	errorCode?:
		| 'extension_missing'
		| 'pubkey_failed'
		| 'sign_failed'
		| 'server_rejected'
		| 'network_error'
		| 'unknown';
	errorMessage?: string;
}

async function getPublicKey(): Promise<string> {
	if (!window.nostr) throw new Error('No Nostr extension found (NIP-07)');
	return window.nostr.getPublicKey();
}

function createUnsignedEvent(pubkey: string, url: string, method: string): any {
	return {
		kind: 27235,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			['u', url],
			['method', method]
		],
		content: '',
		pubkey
	};
}

async function signEvent(event: any): Promise<any> {
	if (!window.nostr) throw new Error('No Nostr extension found (NIP-07)');
	return window.nostr.signEvent(event);
}

export async function loginWithNip98(): Promise<LoginResult> {
	if (!hasNostrExtension()) {
		clearAuth();
		return {
			ok: false,
			errorCode: 'extension_missing',
			errorMessage: 'No Nostr extension found (NIP-07).'
		};
	}

	try {
		const verifyUrl = `${window.location.origin}/api/auth/nip98`;
		let pubkey = '';
		try {
			pubkey = await getPublicKey();
		} catch {
			return {
				ok: false,
				errorCode: 'pubkey_failed',
				errorMessage: 'Unable to read public key from your Nostr extension.'
			};
		}

		const unsigned = createUnsignedEvent(pubkey, verifyUrl, 'POST');
		let signed: any;
		try {
			signed = await signEvent(unsigned);
		} catch {
			return {
				ok: false,
				errorCode: 'sign_failed',
				errorMessage: 'Signature request was rejected or failed in your Nostr extension.'
			};
		}

		const proof = btoa(JSON.stringify(signed));

		const res = await fetch('/api/auth/nip98', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Nostr ${proof}`
			},
			body: JSON.stringify({ pubkey })
		});

		if (!res.ok) {
			const body = await res.json().catch(() => null);
			const message =
				body?.error?.message ??
				body?.message ??
				`Auth failed with status ${res.status}.`;
			clearAuth();
			return {
				ok: false,
				errorCode: 'server_rejected',
				errorMessage: message
			};
		}

		const data = await res.json();
		setAuth(pubkey, data.token, data.expiresIn ?? 3600_000);
		return { ok: true, pubkey };
	} catch (err) {
		console.error('NIP-98 login failed:', err);
		clearAuth();
		return {
			ok: false,
			errorCode: 'network_error',
			errorMessage: 'Network error while attempting NIP-98 login.'
		};
	}
}

export async function logout() {
	const token = getToken();
	await fetch('/api/auth/logout', {
		method: 'POST',
		headers: token ? { Authorization: `Bearer ${token}` } : {}
	}).catch(() => {});
	clearAuth();
}

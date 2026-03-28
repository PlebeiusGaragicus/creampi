import { setAuth, clearAuth } from "../stores/auth";
import { getBffBaseUrl } from "../config/runtime";

export function hasNostrExtension(): boolean {
	return typeof window !== "undefined" && !!window.nostr;
}

async function getPublicKey(): Promise<string> {
	if (!window.nostr) throw new Error("No Nostr extension found (NIP-07)");
	return window.nostr.getPublicKey();
}

function createUnsignedEvent(pubkey: string, url: string, method: string): any {
	return {
		kind: 27235,
		created_at: Math.floor(Date.now() / 1000),
		tags: [
			["u", url],
			["method", method],
		],
		content: "",
		pubkey,
	};
}

async function signEvent(event: any): Promise<any> {
	if (!window.nostr) throw new Error("No Nostr extension found (NIP-07)");
	return window.nostr.signEvent(event);
}

export async function loginWithNip98(): Promise<boolean> {
	try {
		const bffBase = getBffBaseUrl();
		if (!bffBase) {
			const pubkey = await getPublicKey();
			setAuth(pubkey, `nip98-dev-${pubkey}`, 24 * 3600_000);
			return true;
		}

		const verifyUrl = `${bffBase}/auth/nip98/verify`;
		const pubkey = await getPublicKey();
		const unsigned = createUnsignedEvent(pubkey, verifyUrl, "POST");
		const signed = await signEvent(unsigned);
		const proof = btoa(JSON.stringify(signed));

		const res = await fetch(verifyUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Nostr ${proof}`,
			},
			body: JSON.stringify({ pubkey }),
		});

		if (!res.ok) {
			const body = await res.text();
			throw new Error(`Auth failed (${res.status}): ${body}`);
		}

		const data = await res.json();
		setAuth(pubkey, data.token, data.expiresIn ?? 3600_000);
		return true;
	} catch (err) {
		console.error("NIP-98 login failed:", err);
		clearAuth();
		return false;
	}
}

export function logout() {
	clearAuth();
}

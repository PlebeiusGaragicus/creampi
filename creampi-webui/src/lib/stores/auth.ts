import { writable, derived, get } from "svelte/store";

export interface AuthState {
	pubkey: string | null;
	token: string | null;
	expiresAt: number | null;
}

const STORAGE_KEY = "creampi_auth";

function loadPersistedAuth(): AuthState {
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY);
		if (!raw) return { pubkey: null, token: null, expiresAt: null };
		const parsed = JSON.parse(raw) as AuthState;
		if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
			sessionStorage.removeItem(STORAGE_KEY);
			return { pubkey: null, token: null, expiresAt: null };
		}
		return parsed;
	} catch {
		return { pubkey: null, token: null, expiresAt: null };
	}
}

export const authState = writable<AuthState>(loadPersistedAuth());

authState.subscribe((state) => {
	if (state.token) {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} else {
		sessionStorage.removeItem(STORAGE_KEY);
	}
});

export const isAuthenticated = derived(authState, ($s) => !!$s.token && (!$s.expiresAt || $s.expiresAt > Date.now()));
export const pubkey = derived(authState, ($s) => $s.pubkey);

export function setAuth(pubkey: string, token: string, expiresInMs: number = 3600_000) {
	authState.set({ pubkey, token, expiresAt: Date.now() + expiresInMs });
}

export function clearAuth() {
	authState.set({ pubkey: null, token: null, expiresAt: null });
}

export function getToken(): string | null {
	return get(authState).token;
}

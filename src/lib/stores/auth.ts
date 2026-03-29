import { writable, derived, get } from 'svelte/store';

export interface AuthState {
	pubkey: string | null;
	token: string | null;
	expiresAt: number | null;
}

const STORAGE_KEY = 'creampi_auth';

function canUseSessionStorage(): boolean {
	return typeof sessionStorage !== 'undefined';
}

function loadPersistedAuth(): AuthState {
	if (!canUseSessionStorage()) return { pubkey: null, token: null, expiresAt: null };
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
	if (!canUseSessionStorage()) return;
	if (state.token) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	else sessionStorage.removeItem(STORAGE_KEY);
});

export const isAuthenticated = derived(authState, ($s) => !!$s.token && (!$s.expiresAt || $s.expiresAt > Date.now()));
export const pubkey = derived(authState, ($s) => $s.pubkey);

export function setAuth(pubkey: string, token: string, expiresInMs = 3600_000) {
	authState.set({ pubkey, token, expiresAt: Date.now() + expiresInMs });
}

export function clearAuth() {
	authState.set({ pubkey: null, token: null, expiresAt: null });
}

export function isTokenExpired(expiresAt: number | null): boolean {
	return !!expiresAt && expiresAt <= Date.now();
}

export function isAuthenticatedNow(): boolean {
	const state = get(authState);
	return !!state.token && !isTokenExpired(state.expiresAt);
}

export function getToken(): string | null {
	const state = get(authState);
	if (!state.token) return null;
	if (isTokenExpired(state.expiresAt)) {
		clearAuth();
		return null;
	}
	return state.token;
}

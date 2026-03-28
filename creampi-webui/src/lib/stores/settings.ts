import { writable } from "svelte/store";

export interface SelectedModelInfo {
	id: string;
	name: string;
	provider: string;
	baseUrl: string;
	contextWindow: number;
	maxTokens: number;
}

export interface CustomProviderConfig {
	id: string;
	name: string;
	type: "lmstudio" | "openai-compatible";
	baseUrl: string;
	apiKey?: string;
}

function loadJson<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : fallback;
	} catch {
		return fallback;
	}
}

function persistable<T>(key: string, initial: T) {
	const store = writable<T>(loadJson(key, initial));
	store.subscribe((val) => {
		try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
	});
	return store;
}

export const selectedModel = persistable<SelectedModelInfo | null>("creampi_selected_model", null);
export const customProviders = persistable<CustomProviderConfig[]>("creampi_custom_providers", []);

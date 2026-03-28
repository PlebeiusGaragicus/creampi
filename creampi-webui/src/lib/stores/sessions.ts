import { writable, derived } from "svelte/store";

export interface SessionMeta {
	id: string;
	title: string;
	createdAt: string;
	lastModified: string;
	messageCount: number;
	preview: string;
}

export const currentSessionId = writable<string | undefined>(undefined);
export const currentTitle = writable<string>("");
export const sessionList = writable<SessionMeta[]>([]);
export const isEditingTitle = writable<boolean>(false);

export const hasActiveSession = derived(currentSessionId, ($id) => !!$id);

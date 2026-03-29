import { writable } from "svelte/store";
import { fetchSessionFiles, uploadSessionFile, deleteSessionFile } from "../api/client";

export interface SessionFile {
	id: string;
	name: string;
	size: number;
	mimeType: string;
	createdAt: string;
}

export const sessionFiles = writable<SessionFile[]>([]);

export async function loadSessionFiles(sessionId: string): Promise<SessionFile[]> {
	try {
		const files = await fetchSessionFiles(sessionId);
		sessionFiles.set(files);
		return files;
	} catch {
		sessionFiles.set([]);
		return [];
	}
}

export async function addSessionFile(sessionId: string, file: File): Promise<SessionFile | null> {
	try {
		const result = await uploadSessionFile(sessionId, file);
		await loadSessionFiles(sessionId);
		return result;
	} catch {
		return null;
	}
}

export async function removeSessionFile(sessionId: string, fileId: string): Promise<void> {
	try {
		await deleteSessionFile(sessionId, fileId);
		await loadSessionFiles(sessionId);
	} catch {}
}

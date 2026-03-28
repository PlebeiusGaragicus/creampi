import { getAppStorage } from "../pi/storage";
import { currentSessionId, currentTitle, sessionList, type SessionMeta } from "../stores/sessions";

export async function loadSessionList(): Promise<SessionMeta[]> {
	const storage = getAppStorage();
	const allMeta = await storage.sessions.getAllMetadata();
	const mapped: SessionMeta[] = (allMeta ?? []).map((m: any) => ({
		id: m.id,
		title: m.title || "Untitled",
		createdAt: m.createdAt,
		lastModified: m.lastModified,
		messageCount: m.messageCount ?? 0,
		preview: m.preview ?? "",
	}));
	mapped.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
	sessionList.set(mapped);
	return mapped;
}

export async function getSessionData(sessionId: string) {
	const storage = getAppStorage();
	return storage.sessions.get(sessionId);
}

export async function getSessionMeta(sessionId: string) {
	const storage = getAppStorage();
	return storage.sessions.getMetadata(sessionId);
}

export async function deleteSession(sessionId: string) {
	const storage = getAppStorage();
	await storage.sessions.delete(sessionId);
	await loadSessionList();
}

export async function updateSessionTitle(sessionId: string, newTitle: string) {
	const storage = getAppStorage();
	await storage.sessions.updateTitle(sessionId, newTitle);
	currentTitle.set(newTitle);
	await loadSessionList();
}

export function resetSession() {
	currentSessionId.set(undefined);
	currentTitle.set("");
}

import { fetchSessionById, fetchSessions, deleteSessionRemote, saveSessionRemote } from '$lib/api/client';
import { currentSessionId, currentTitle, sessionList, type SessionMeta } from '$lib/stores/sessions';

export async function loadSessionList(): Promise<SessionMeta[]> {
	const allMeta = await fetchSessions().catch(() => []);
	const mapped: SessionMeta[] = (allMeta ?? []).map((m: any) => ({
		id: m.id,
		title: m.title || 'Untitled',
		createdAt: m.createdAt,
		lastModified: m.lastModified,
		messageCount: m.messageCount ?? 0,
		preview: m.preview ?? '',
		modelId: m.modelId ?? null,
		agentKind: m.agentKind ?? 'chat'
	}));
	sessionList.set(mapped);
	return mapped;
}

export async function getSessionData(sessionId: string) {
	const found = await fetchSessionById(sessionId);
	if (!found) return null;
	return {
		id: found.id,
		title: found.title,
		model: undefined,
		thinkingLevel: found.thinkingLevel ?? 'off',
		messages: found.messages ?? []
	};
}

export async function getSessionMeta(sessionId: string) {
	return fetchSessionById(sessionId);
}

export async function deleteSession(sessionId: string) {
	await deleteSessionRemote(sessionId);
	await loadSessionList();
}

export async function updateSessionTitle(sessionId: string, newTitle: string) {
	const now = new Date().toISOString();
	await saveSessionRemote({ id: sessionId, title: newTitle, messages: [] }, { lastModified: now, preview: newTitle });
	currentTitle.set(newTitle);
	await loadSessionList();
}

export function resetSession() {
	currentSessionId.set(undefined);
	currentTitle.set('');
}

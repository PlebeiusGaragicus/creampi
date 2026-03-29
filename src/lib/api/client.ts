import { clearAuth, getToken } from '$lib/stores/auth';
import type { SessionFile } from '$lib/shared/types';

function authHeaders(): Record<string, string> {
	const token = getToken();
	return token ? { Authorization: `Bearer ${token}` } : {};
}

function handleUnauthorized(): void {
	clearAuth();
	if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
		const next = `${window.location.pathname}${window.location.search}`;
		window.location.assign(`/login?next=${encodeURIComponent(next)}`);
	}
}

async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
	const headers = { ...(init.headers ?? {}), ...authHeaders() };
	const response = await fetch(input, { ...init, headers });
	if (response.status === 401) {
		handleUnauthorized();
	}
	return response;
}

export async function fetchSessions(): Promise<any[]> {
	const res = await apiFetch('/api/sessions');
	if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
	return res.json();
}

export async function fetchSessionById(sessionId: string): Promise<any | null> {
	const res = await apiFetch(`/api/sessions/${sessionId}`);
	if (!res.ok) return null;
	return res.json();
}

export async function saveSessionRemote(sessionData: any, metadata: any): Promise<void> {
	const res = await apiFetch('/api/sessions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ session: sessionData, metadata })
	});
	if (!res.ok) {
		throw new Error(`Failed to save session: ${res.status}`);
	}
}

export async function deleteSessionRemote(sessionId: string): Promise<void> {
	const res = await apiFetch(`/api/sessions/${sessionId}`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		throw new Error(`Failed to delete session: ${res.status}`);
	}
}

export async function fetchSessionFiles(sessionId: string): Promise<SessionFile[]> {
	const res = await apiFetch(`/api/sessions/${sessionId}/files`);
	if (!res.ok) return [];
	return res.json();
}

export async function uploadSessionFile(sessionId: string, file: File): Promise<SessionFile> {
	const form = new FormData();
	form.append('file', file);
	const res = await apiFetch(`/api/sessions/${sessionId}/files`, {
		method: 'POST',
		body: form
	});
	if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
	return res.json();
}

export async function deleteSessionFile(sessionId: string, fileId: string): Promise<void> {
	const res = await apiFetch(`/api/sessions/${sessionId}/files?fileId=${encodeURIComponent(fileId)}`, {
		method: 'DELETE'
	});
	if (!res.ok) {
		throw new Error(`Failed to delete file: ${res.status}`);
	}
}

export async function discoverModels(): Promise<{ models: any[]; defaultModel?: string }> {
	const res = await apiFetch('/api/models');
	if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
	return res.json();
}

export async function sendTelemetry(events: any[]): Promise<void> {
	await apiFetch('/api/telemetry/events', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ events })
	}).catch(() => {});
}

export interface ChatStreamCallbacks {
	onTextDelta?: (delta: string) => void;
	onToolCall?: (name: string, args: Record<string, unknown>) => void;
	onToolResult?: (name: string, result: string) => void;
	onAgentEnd?: (messages: unknown[]) => void;
	onError?: (message: string) => void;
}

export async function streamComputerChat(
	sessionId: string,
	message: string,
	callbacks: ChatStreamCallbacks,
	opts?: { model?: string; provider?: string }
): Promise<void> {
	const res = await apiFetch('/api/chat/stream', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ sessionId, message, model: opts?.model, provider: opts?.provider, agentKind: 'computer' })
	});
	if (!res.ok || !res.body) {
		callbacks.onError?.(`Chat request failed: ${res.status}`);
		return;
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let currentEvent = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';
		for (const line of lines) {
			if (line.startsWith('event: ')) {
				currentEvent = line.slice(7).trim();
			} else if (line.startsWith('data: ') && currentEvent) {
				try {
					const data = JSON.parse(line.slice(6));
					switch (currentEvent) {
						case 'text_delta':
							callbacks.onTextDelta?.(data.delta);
							break;
						case 'tool_call':
							callbacks.onToolCall?.(data.name, data.args);
							break;
						case 'tool_result':
							callbacks.onToolResult?.(data.name, data.result);
							break;
						case 'agent_end':
							callbacks.onAgentEnd?.(data.messages);
							break;
						case 'error':
							callbacks.onError?.(data.message);
							break;
					}
				} catch {
					// ignore malformed chunk
				}
				currentEvent = '';
			}
		}
	}
}

export async function abortComputerChat(sessionId: string): Promise<void> {
	await apiFetch('/api/chat/abort', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ sessionId })
	}).catch(() => {});
}

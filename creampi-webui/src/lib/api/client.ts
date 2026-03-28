import { getToken } from "../stores/auth";
import { getBffBaseUrl, getLmStudioBaseUrl } from "../config/runtime";
import type { SessionFile } from "../stores/files";

function authHeaders(): Record<string, string> {
	const token = getToken();
	if (!token) return {};
	return { Authorization: `Bearer ${token}` };
}

function bffUrl(path: string): string {
	return `${getBffBaseUrl()}${path}`;
}

// ── Sessions ──

export async function fetchSessions(): Promise<any[]> {
	const base = getBffBaseUrl();
	if (!base) return [];
	const res = await fetch(bffUrl("/sessions"), { headers: authHeaders() });
	if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
	return res.json();
}

export async function saveSessionRemote(sessionData: any, metadata: any): Promise<void> {
	const base = getBffBaseUrl();
	if (!base) return;
	await fetch(bffUrl("/sessions"), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify({ session: sessionData, metadata }),
	});
}

export async function deleteSessionRemote(sessionId: string): Promise<void> {
	const base = getBffBaseUrl();
	if (!base) return;
	await fetch(bffUrl(`/sessions/${sessionId}`), {
		method: "DELETE",
		headers: authHeaders(),
	});
}

// ── Telemetry ──

export async function sendTelemetry(events: any[]): Promise<void> {
	const base = getBffBaseUrl();
	if (!base) return;
	await fetch(bffUrl("/telemetry/events"), {
		method: "POST",
		headers: { "Content-Type": "application/json", ...authHeaders() },
		body: JSON.stringify({ events }),
	}).catch(() => {});
}

// ── Session Files (backend-first, stubbed) ──

export async function fetchSessionFiles(sessionId: string): Promise<SessionFile[]> {
	const base = getBffBaseUrl();
	if (!base) return [];
	try {
		const res = await fetch(bffUrl(`/sessions/${sessionId}/files`), { headers: authHeaders() });
		if (!res.ok) return [];
		return res.json();
	} catch {
		return [];
	}
}

export async function uploadSessionFile(sessionId: string, file: File): Promise<SessionFile> {
	const base = getBffBaseUrl();
	if (!base) {
		return {
			id: crypto.randomUUID(),
			name: file.name,
			size: file.size,
			mimeType: file.type || "application/octet-stream",
			createdAt: new Date().toISOString(),
		};
	}
	const form = new FormData();
	form.append("file", file);
	const res = await fetch(bffUrl(`/sessions/${sessionId}/files`), {
		method: "POST",
		headers: authHeaders(),
		body: form,
	});
	if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
	return res.json();
}

export async function deleteSessionFile(sessionId: string, fileId: string): Promise<void> {
	const base = getBffBaseUrl();
	if (!base) return;
	await fetch(bffUrl(`/sessions/${sessionId}/files/${fileId}`), {
		method: "DELETE",
		headers: authHeaders(),
	});
}

// ── Model Discovery ──

export interface DiscoveredModel {
	id: string;
	name: string;
	contextWindow?: number;
	maxTokens?: number;
}

export async function discoverLmStudioModels(): Promise<DiscoveredModel[]> {
	const baseUrl = getLmStudioBaseUrl();
	if (!baseUrl) return [];
	try {
		const res = await fetch(`${baseUrl}/v1/models`);
		if (!res.ok) return [];
		const data = await res.json();
		if (!data.data || !Array.isArray(data.data)) return [];
		return data.data.map((m: any) => ({
			id: m.id,
			name: m.id,
			contextWindow: m.context_length ?? 8192,
			maxTokens: m.max_tokens ?? 4096,
		}));
	} catch {
		return [];
	}
}

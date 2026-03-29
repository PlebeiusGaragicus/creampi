import { sendTelemetry } from "../api/client";

export interface TelemetryEvent {
	type: string;
	timestamp: number;
	correlationId?: string;
	data: Record<string, unknown>;
}

const buffer: TelemetryEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 5000;
const MAX_BUFFER_SIZE = 50;

export function emit(type: string, data: Record<string, unknown> = {}, correlationId?: string) {
	buffer.push({ type, timestamp: Date.now(), correlationId, data });
	if (buffer.length >= MAX_BUFFER_SIZE) flush();
	if (!flushTimer) {
		flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
	}
}

export async function flush() {
	if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
	if (buffer.length === 0) return;
	const batch = buffer.splice(0);
	try {
		await sendTelemetry(batch);
	} catch {
		buffer.unshift(...batch);
	}
}

export function emitAuthEvent(action: "login" | "logout" | "login_failed", pubkey?: string) {
	emit("auth", { action, pubkey });
}

export function emitPromptEvent(sessionId: string, durationMs: number, inputTokens: number, outputTokens: number) {
	emit("prompt", { sessionId, durationMs, inputTokens, outputTokens }, sessionId);
}

export function emitToolEvent(sessionId: string, toolName: string, durationMs: number, success: boolean) {
	emit("tool", { sessionId, toolName, durationMs, success }, sessionId);
}

export function emitErrorEvent(context: string, error: string, sessionId?: string) {
	emit("error", { context, error }, sessionId);
}

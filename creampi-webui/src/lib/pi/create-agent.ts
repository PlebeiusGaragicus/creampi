import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentState } from "@mariozechner/pi-web-ui";
import {
	ChatPanel,
	createJavaScriptReplTool,
	defaultConvertToLlm,
} from "@mariozechner/pi-web-ui";
import { getLmModel } from "../config/runtime";
import { agentStore, chatPanelStore, isStreaming } from "../stores/agent";
import { currentSessionId, currentTitle } from "../stores/sessions";
import { selectedModel } from "../stores/settings";
import { get } from "svelte/store";
import { emitPromptEvent, emitErrorEvent } from "../observability/events";
import { Span } from "../observability/tracing";

let agentUnsubscribe: (() => void) | undefined;

export function getOrCreateChatPanel(): ChatPanel {
	const existing = get(chatPanelStore);
	if (existing) return existing;
	const panel = new ChatPanel();
	chatPanelStore.set(panel);
	return panel;
}

function generateTitle(messages: any[]): string {
	const first = messages.find((m: any) => m.role === "user" || m.role === "user-with-attachments");
	if (!first || (first.role !== "user" && first.role !== "user-with-attachments")) return "";
	let text = typeof first.content === "string"
		? first.content
		: (first.content as any[]).filter((c: any) => c.type === "text").map((c: any) => c.text || "").join(" ");
	text = text.trim();
	if (!text) return "";
	const end = text.search(/[.!?]/);
	if (end > 0 && end <= 50) return text.substring(0, end + 1);
	return text.length <= 50 ? text : `${text.substring(0, 47)}...`;
}

function shouldSaveSession(messages: any[]): boolean {
	return messages.some((m: any) => m.role === "user" || m.role === "user-with-attachments") &&
		messages.some((m: any) => m.role === "assistant");
}

export async function createAgent(
	chatPanel: ChatPanel,
	storage: any,
	initialState?: Partial<AgentState>,
) {
	if (agentUnsubscribe) agentUnsubscribe();

	const saved = get(selectedModel);
	const model = saved
		? {
			id: saved.id,
			name: saved.name,
			api: "openai-completions" as const,
			provider: saved.provider,
			baseUrl: saved.baseUrl,
			reasoning: false,
			input: ["text" as const],
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			contextWindow: saved.contextWindow,
			maxTokens: saved.maxTokens,
		}
		: getLmModel();

	const agent = new Agent({
		initialState: initialState || {
			systemPrompt: "You are a helpful AI assistant.",
			model,
			thinkingLevel: "off",
			messages: [],
			tools: [],
		},
		convertToLlm: defaultConvertToLlm,
	});

	agentStore.set(agent);

	let promptSpan: Span | null = null;

	agentUnsubscribe = agent.subscribe((event: any) => {
		if (event.type === "agent_start") {
			isStreaming.set(true);
			promptSpan = new Span("prompt");
		}

		if (event.type === "agent_end") {
			isStreaming.set(false);
			if (promptSpan) {
				const result = promptSpan.end();
				const sid = get(currentSessionId);
				if (sid) emitPromptEvent(sid, result.durationMs, 0, 0);
				promptSpan = null;
			}
		}

		if (event.type === "message_end" || event.type === "agent_end") {
			const messages = agent.state.messages;
			const title = get(currentTitle);
			const sessionId = get(currentSessionId);

			if (!title && shouldSaveSession(messages)) {
				currentTitle.set(generateTitle(messages) || "New chat");
			}
			if (!sessionId && shouldSaveSession(messages)) {
				const newId = crypto.randomUUID();
				currentSessionId.set(newId);
				rememberLastSession(newId);
				const url = new URL(window.location.href);
				url.hash = `#/chat?session=${newId}`;
				window.history.replaceState({}, "", url);
			}

			const sid = get(currentSessionId);
			if (sid && shouldSaveSession(messages)) {
				const t = get(currentTitle) || "New chat";
				rememberLastSession(sid);
				saveSession(agent, storage, sid, t, messages).catch((err) => {
					emitErrorEvent("session_save", String(err), sid);
				});
			}
		}
	});

	await chatPanel.setAgent(agent, {
		toolsFactory: (_agent, _agentInterface, _artifactsPanel, runtimeProvidersFactory) => {
			const replTool = createJavaScriptReplTool();
			replTool.runtimeProvidersFactory = runtimeProvidersFactory;
			return [replTool];
		},
	});

	chatPanel.agentInterface!.enableModelSelector = true;
	chatPanel.agentInterface!.enableThinkingSelector = true;

	return agent;
}

const LAST_SESSION_KEY = "creampi_last_session_id";

export function rememberLastSession(id: string) {
	try { sessionStorage.setItem(LAST_SESSION_KEY, id); } catch {}
}

export function getLastSessionId(): string | null {
	try { return sessionStorage.getItem(LAST_SESSION_KEY); } catch { return null; }
}

async function saveSession(agent: Agent, storage: any, sessionId: string, title: string, messages: any[]) {
	if (!shouldSaveSession(messages)) return;
	const state = agent.state;
	const now = new Date().toISOString();

	const existing = await storage.sessions.get(sessionId);
	const createdAt = existing?.createdAt ?? now;

	await storage.sessions.save(
		{
			id: sessionId,
			title,
			model: state.model!,
			thinkingLevel: state.thinkingLevel,
			messages: state.messages,
			createdAt,
			lastModified: now,
		},
		{
			id: sessionId,
			title,
			createdAt,
			lastModified: now,
			messageCount: state.messages.length,
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
			modelId: state.model?.id || null,
			thinkingLevel: state.thinkingLevel,
			preview: title,
		},
	);
}

export type AgentKind = 'chat' | 'computer';

export interface SessionMeta {
	id: string;
	title: string;
	createdAt: string;
	lastModified: string;
	messageCount: number;
	modelId: string | null;
	preview: string;
	agentKind: AgentKind;
}

export interface SessionFile {
	id: string;
	name: string;
	size: number;
	mimeType: string;
	createdAt: string;
}

export interface ChatStreamEvent {
	type: 'text_delta' | 'tool_call' | 'tool_result' | 'agent_end' | 'error';
	data: Record<string, unknown>;
}

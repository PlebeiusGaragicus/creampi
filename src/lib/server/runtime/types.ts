import type { AgentKind } from '$lib/shared/types';

export interface AgentTurnRequest {
	sessionId: string;
	message: string;
	model?: string;
	provider?: string;
	pubkey: string;
	agentKind: AgentKind;
}

export interface AgentEvent {
	type: 'text_delta' | 'tool_call' | 'tool_result' | 'agent_end' | 'error';
	data: Record<string, unknown>;
}

export type AgentEventCallback = (event: AgentEvent) => void;

export interface RuntimeAdapter {
	executeTurn(request: AgentTurnRequest, onEvent: AgentEventCallback): Promise<void>;
	abortTurn(sessionId: string): void;
	shutdown(): Promise<void>;
}

import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from '@mariozechner/pi-coding-agent';
import type { RuntimeAdapter, AgentTurnRequest, AgentEventCallback } from './types';
import { config } from '../config';

interface EmbeddedState {
	session: any;
	unsubscribe?: () => void;
}

export class EmbeddedAdapter implements RuntimeAdapter {
	private sessions = new Map<string, EmbeddedState>();

	private async getOrCreate(request: AgentTurnRequest, onEvent: AgentEventCallback): Promise<EmbeddedState> {
		const existing = this.sessions.get(request.sessionId);
		if (existing) return existing;

		const authStorage = AuthStorage.create();
		const modelRegistry = new ModelRegistry(authStorage);
		const model = request.model || config.lmStudio.defaultModel || undefined;

		const created = await createAgentSession({
			authStorage,
			modelRegistry,
			sessionManager: SessionManager.inMemory(),
			...(model ? { model } : {})
		} as any);

		const state: EmbeddedState = { session: created.session };
		state.unsubscribe = created.session.subscribe((event: any) => {
			switch (event.type) {
				case 'message_update': {
					const assistantEvent = event.assistantMessageEvent;
					if (assistantEvent?.type === 'text_delta') {
						onEvent({ type: 'text_delta', data: { delta: assistantEvent.delta } });
					}
					break;
				}
				case 'tool_call_start':
					onEvent({ type: 'tool_call', data: { name: event.name ?? 'unknown', args: event.arguments ?? {} } });
					break;
				case 'tool_result':
					onEvent({ type: 'tool_result', data: { name: event.name ?? 'unknown', result: event.result ?? '' } });
					break;
				case 'agent_end':
					onEvent({ type: 'agent_end', data: { messages: event.messages ?? [] } });
					break;
			}
		});

		this.sessions.set(request.sessionId, state);
		return state;
	}

	async executeTurn(request: AgentTurnRequest, onEvent: AgentEventCallback): Promise<void> {
		const state = await this.getOrCreate(request, onEvent);
		try {
			await state.session.prompt(request.message);
		} catch (err) {
			onEvent({ type: 'error', data: { message: err instanceof Error ? err.message : String(err) } });
		}
	}

	abortTurn(sessionId: string): void {
		const state = this.sessions.get(sessionId);
		if (!state) return;
		try {
			state.session.abort();
		} catch {
			// best effort
		}
	}

	async shutdown(): Promise<void> {
		for (const state of this.sessions.values()) {
			state.unsubscribe?.();
		}
		this.sessions.clear();
	}
}

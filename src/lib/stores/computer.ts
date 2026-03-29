import { writable } from 'svelte/store';

export interface ComputerMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface ComputerToolEvent {
	type: 'tool_call' | 'tool_result';
	name: string;
	payload: string;
	at: string;
}

export const computerMessages = writable<ComputerMessage[]>([]);
export const computerEvents = writable<ComputerToolEvent[]>([]);
export const computerStreaming = writable(false);

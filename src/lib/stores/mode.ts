import { writable } from 'svelte/store';
import type { AgentKind } from '$lib/shared/types';

export const activeMode = writable<AgentKind>('chat');

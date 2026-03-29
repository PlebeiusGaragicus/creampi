import { writable } from "svelte/store";
import type { Agent } from "@mariozechner/pi-agent-core";
import type { ChatPanel } from "@mariozechner/pi-web-ui";

export const agentStore = writable<Agent | null>(null);
export const chatPanelStore = writable<ChatPanel | null>(null);
export const isStreaming = writable<boolean>(false);

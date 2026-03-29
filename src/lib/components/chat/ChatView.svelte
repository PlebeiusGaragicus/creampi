<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { currentSessionId, currentTitle } from '$lib/stores/sessions';
	import { getSessionData, getSessionMeta, loadSessionList } from '$lib/sessions/session-service';
	import { loadSessionFiles } from '$lib/stores/files';
	import type { AgentState, AppStorage, ChatPanel } from '@mariozechner/pi-web-ui';

	export let sessionId: string | null = null;

	let chatContainer: HTMLDivElement;
	let loading = true;
	let chatPanel: ChatPanel | null = null;
	let booted = false;
	let lastLoadedSid: string | null | undefined = undefined;

	type ChatAgentModule = typeof import('$lib/pi/chat-agent');
	type StorageModule = typeof import('$lib/pi/storage');

	let chatAgentModule: ChatAgentModule | null = null;
	let storageModule: StorageModule | null = null;

	async function ensureClientModules() {
		if (!browser) return;
		if (chatAgentModule && storageModule) return;
		[chatAgentModule, storageModule] = await Promise.all([
			import('$lib/pi/chat-agent'),
			import('$lib/pi/storage')
		]);
	}

	async function loadSessionById(sid: string) {
		if (!chatAgentModule || !storageModule || !chatPanel) return;
		const storage: AppStorage = await storageModule.initStorage();
		const data = await getSessionData(sid);
		if (data) {
			currentSessionId.set(sid);
			chatAgentModule.rememberLastSession(sid);
			const meta = await getSessionMeta(sid);
			currentTitle.set(meta?.title || '');
			await chatAgentModule.createAgent(chatPanel, storage, {
				model: data.model,
				thinkingLevel: data.thinkingLevel,
				messages: data.messages,
				tools: []
			} as Partial<AgentState>);
			await loadSessionFiles(sid);
		} else {
			chatAgentModule.clearLastSession();
			await chatAgentModule.createAgent(chatPanel, storage);
		}
	}

	async function boot() {
		if (!browser) return;
		await ensureClientModules();
		if (!chatAgentModule || !storageModule) return;

		const storage: AppStorage = await storageModule.initStorage();
		chatPanel = chatAgentModule.getOrCreateChatPanel();
		const candidateSid = sessionId ?? chatAgentModule.getLastSessionId();

		if (candidateSid) {
			await loadSessionById(candidateSid);
		} else {
			await chatAgentModule.createAgent(chatPanel, storage);
		}

		lastLoadedSid = sessionId;
		await loadSessionList();
		loading = false;
		booted = true;
		await tick();
		if (chatPanel && chatContainer && !chatContainer.contains(chatPanel)) {
			chatPanel.style.flex = '1 1 0%';
			chatPanel.style.minHeight = '0';
			chatPanel.style.overflow = 'hidden';
			chatContainer.appendChild(chatPanel);
		}
	}

	$: if (booted && sessionId !== lastLoadedSid) {
		lastLoadedSid = sessionId;
		if (sessionId) {
			loadSessionById(sessionId);
		}
	}

	onMount(() => {
		boot();
	});
</script>

<div class="h-full min-h-0 flex flex-col bg-background text-foreground">
	<div class="shrink-0 border-b border-border px-4 py-3 flex items-center justify-between">
		<div class="min-w-0">
			<div class="text-sm font-semibold truncate">{$currentTitle || 'New Chat'}</div>
		</div>
		<div class="flex items-center gap-2">
			<button
				class="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-foreground hover:bg-accent transition"
				onclick={() => goto('/settings')}
			>
				Settings
			</button>
		</div>
	</div>

	{#if loading}
		<div class="p-4 text-sm text-muted-foreground">Loading chat...</div>
	{:else}
		<div bind:this={chatContainer} class="chat-panel-host"></div>
	{/if}
</div>

<style>
	.chat-panel-host {
		display: flex;
		flex-direction: column;
		height: 100%;
		flex: 1 1 0%;
		min-height: 0;
		overflow: hidden;
	}
</style>

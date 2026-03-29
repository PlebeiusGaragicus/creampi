<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { currentSessionId, sessionList } from '$lib/stores/sessions';
	import { deleteSession, loadSessionList } from '$lib/sessions/session-service';

	let search = '';

	onMount(async () => {
		await loadSessionList();
	});

	$: filtered = $sessionList.filter((s) => s.agentKind === 'chat' && s.title.toLowerCase().includes(search.toLowerCase()));

	async function handleNewChat() {
		if (!browser) return;
		const { startNewChat } = await import('$lib/pi/chat-agent');
		await startNewChat();
		goto('/chat');
	}
</script>

<div class="p-4 space-y-3">
	<button
		class="w-full rounded-md border border-border bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 transition"
		onclick={handleNewChat}
	>
		+ New Chat
	</button>
	<input
		class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
		placeholder="Search chats"
		bind:value={search}
	/>
</div>

<div class="px-4 pb-4 min-h-0 flex-1 overflow-auto">
	<div class="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Threads</div>
	{#if filtered.length === 0}
		<div class="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
			No chat threads yet.
		</div>
	{:else}
		<div class="space-y-2">
			{#each filtered as thread}
				<div class="flex items-center gap-2">
					<button
						class="flex-1 text-left rounded-md border px-3 py-2 text-sm transition truncate
							{thread.id === $currentSessionId
								? 'border-primary bg-primary/10 text-foreground'
								: 'border-border bg-secondary/30 text-foreground hover:bg-accent'}"
						onclick={() => goto(`/chat/${thread.id}`)}
						title={thread.title}
					>
						{thread.title}
					</button>
					<button
						class="rounded-md border border-border bg-background px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition"
						onclick={() => deleteSession(thread.id)}
						title="Delete chat"
					>
						Delete
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

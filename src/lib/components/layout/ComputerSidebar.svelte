<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { currentSessionId, sessionList } from '$lib/stores/sessions';
	import { deleteSession, loadSessionList } from '$lib/sessions/session-service';

	onMount(async () => {
		await loadSessionList();
	});

	$: agents = $sessionList.filter((s) => s.agentKind === 'computer');
</script>

<div class="section">
	<button class="primary" onclick={() => goto('/computer')}>+ New Agent</button>
</div>

<div class="section">
	<div class="title">Computer Agents</div>
	{#if agents.length === 0}
		<div class="empty">No computer agents yet</div>
	{:else}
		{#each agents as agent}
			<div class="item" class:selected={agent.id === $currentSessionId}>
				<button class="grow" onclick={() => goto(`/computer/${agent.id}`)}>
					<div class="name">{agent.title}</div>
					<div class="meta">idle · {new Date(agent.lastModified).toLocaleString()}</div>
				</button>
				<button class="danger" onclick={() => deleteSession(agent.id)}>x</button>
			</div>
		{/each}
	{/if}
</div>

<div class="section">
	<div class="title">Selected Agent</div>
	<div class="empty">Status: sandbox idle</div>
	<div class="empty">Actions: restart · stop · logs</div>
	<div class="empty">Integrations: Gitea · ntfy · strfry</div>
</div>

<style>
	.section { display: grid; gap: 0.5rem; margin-bottom: 1rem; }
	.title { font-size: 0.75rem; text-transform: uppercase; color: #9ca3af; }
	.empty { font-size: 0.85rem; color: #6b7280; }
	.primary { background: #16a34a; color: white; border: none; padding: 0.5rem; border-radius: 0.5rem; cursor: pointer; }
	.item { display: flex; gap: 0.4rem; align-items: center; }
	.grow { flex: 1; text-align: left; background: #111827; color: #e5e7eb; border: 1px solid #374151; border-radius: 0.5rem; padding: 0.45rem; cursor: pointer; }
	.item.selected .grow { border-color: #16a34a; }
	.name { font-weight: 600; }
	.meta { font-size: 0.75rem; color: #9ca3af; }
	.danger { background: transparent; color: #f87171; border: none; cursor: pointer; }
</style>

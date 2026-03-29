<script lang="ts">
	import { onMount } from 'svelte';
	import { abortComputerChat, saveSessionRemote, streamComputerChat } from '$lib/api/client';
	import { computerEvents, computerMessages, computerStreaming } from '$lib/stores/computer';
	import { currentSessionId } from '$lib/stores/sessions';
	import { loadSessionList } from '$lib/sessions/session-service';

	export let sessionId: string | null = null;
	let input = '';

	onMount(async () => {
		if (sessionId) currentSessionId.set(sessionId);
		await loadSessionList();
	});

	async function ensureSession(): Promise<string> {
		let sid = sessionId ?? $currentSessionId;
		if (sid) return sid;
		sid = crypto.randomUUID();
		currentSessionId.set(sid);
		await saveSessionRemote(
			{ id: sid, title: 'Computer Agent', messages: [] },
			{ createdAt: new Date().toISOString(), lastModified: new Date().toISOString(), messageCount: 0, preview: '', agentKind: 'computer' }
		);
		await loadSessionList();
		return sid;
	}

	async function send() {
		const text = input.trim();
		if (!text || $computerStreaming) return;
		const sid = await ensureSession();
		computerMessages.update((m) => [...m, { role: 'user', content: text }]);
		computerMessages.update((m) => [...m, { role: 'assistant', content: '' }]);
		input = '';
		computerStreaming.set(true);

		await streamComputerChat(
			sid,
			text,
			{
				onTextDelta(delta) {
					computerMessages.update((m) => {
						const next = [...m];
						const idx = next.length - 1;
						next[idx] = { ...next[idx], content: next[idx].content + delta };
						return next;
					});
				},
				onToolCall(name, args) {
					computerEvents.update((events) => [...events, { type: 'tool_call', name, payload: JSON.stringify(args), at: new Date().toISOString() }]);
				},
				onToolResult(name, result) {
					computerEvents.update((events) => [...events, { type: 'tool_result', name, payload: result, at: new Date().toISOString() }]);
				},
				onError(message) {
					computerMessages.update((m) => [...m, { role: 'system', content: `Error: ${message}` }]);
				}
			}
		);

		computerStreaming.set(false);
	}

	async function abort() {
		if (!$currentSessionId) return;
		await abortComputerChat($currentSessionId);
		computerStreaming.set(false);
	}
</script>

<div class="computer-view">
	<div class="messages">
		{#each $computerMessages as msg}
			<div class="msg {msg.role}">
				<strong>{msg.role}:</strong> {msg.content}
			</div>
		{/each}
	</div>

	<div class="composer">
		<textarea bind:value={input} rows="3" placeholder="Instruct computer agent..."></textarea>
		<div class="actions">
			<button onclick={send} disabled={$computerStreaming}>Send</button>
			<button onclick={abort} disabled={!$computerStreaming}>Abort</button>
		</div>
	</div>

	<div class="events">
		<h3>Tool Events</h3>
		{#each $computerEvents.slice(-8) as ev}
			<div class="event">
				<span>{ev.type}</span> <b>{ev.name}</b>
			</div>
		{/each}
	</div>
</div>

<style>
	.computer-view { display: grid; grid-template-rows: 1fr auto auto; height: 100vh; }
	.messages { overflow: auto; padding: 1rem; display: grid; gap: 0.5rem; }
	.msg { padding: 0.6rem; border-radius: 0.5rem; }
	.msg.user { background: #1f2937; }
	.msg.assistant { background: #0f172a; }
	.msg.system { background: #3f1d2e; }
	.composer { padding: 1rem; border-top: 1px solid #1f2937; display: grid; gap: 0.6rem; }
	textarea { width: 100%; background: #111827; color: #e5e7eb; border: 1px solid #374151; border-radius: 0.5rem; padding: 0.6rem; }
	.actions { display: flex; gap: 0.5rem; }
	button { background: #2563eb; color: white; border: none; border-radius: 0.5rem; padding: 0.5rem 0.8rem; cursor: pointer; }
	button[disabled] { opacity: 0.5; cursor: not-allowed; }
	.events { border-top: 1px solid #1f2937; padding: 0.75rem 1rem; max-height: 180px; overflow: auto; }
	.event { font-size: 0.85rem; color: #cbd5e1; }
</style>

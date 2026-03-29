<script lang="ts">
	import { goto } from '$app/navigation';
	import { activeMode } from '$lib/stores/mode';

	function setMode(mode: 'chat' | 'computer') {
		activeMode.set(mode);
		goto(mode === 'chat' ? '/chat' : '/computer');
	}
</script>

<div class="mode-switch">
	<button class:active={$activeMode === 'chat'} onclick={() => setMode('chat')}>Chat</button>
	<button class:active={$activeMode === 'computer'} onclick={() => setMode('computer')}>Computer</button>
</div>

<style>
	.mode-switch {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.25rem;
		padding: 0.5rem;
		background: #111827;
		border-radius: 0.6rem;
	}
	button {
		padding: 0.5rem;
		border: none;
		border-radius: 0.5rem;
		background: transparent;
		color: #9ca3af;
		font-weight: 600;
		cursor: pointer;
	}
	button.active {
		background: #1f2937;
		color: #f9fafb;
	}
</style>

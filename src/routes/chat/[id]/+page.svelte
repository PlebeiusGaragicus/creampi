<script lang="ts">
	import { page } from '$app/stores';
	import { activeMode } from '$lib/stores/mode';
	import { onMount } from 'svelte';
	import ChatView from '$lib/components/chat/ChatView.svelte';

	onMount(() => activeMode.set('chat'));
	$: sessionId = $page.params.id;
</script>

<ChatView {sessionId} />

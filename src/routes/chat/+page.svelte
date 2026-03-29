<script lang="ts">
	import { activeMode } from '$lib/stores/mode';
	import { onMount } from 'svelte';
	import ChatView from '$lib/components/chat/ChatView.svelte';

	onMount(() => activeMode.set('chat'));
</script>

<ChatView sessionId={null} />

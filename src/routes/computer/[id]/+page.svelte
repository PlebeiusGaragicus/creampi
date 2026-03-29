<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	$: sessionId = $page.params.id;

	onMount(() => {
		goto(`/chat/${sessionId}`);
	});
</script>

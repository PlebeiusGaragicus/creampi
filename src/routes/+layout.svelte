<script lang="ts">
	import '../app.css';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import type { LayoutData } from './$types';

	export let data: LayoutData;
</script>

{#if data.authenticated}
	<div class="app-shell">
		<Sidebar />
		<main class="main-content">
			<slot />
		</main>
	</div>
{:else}
	<slot />
{/if}

<style>
	.app-shell {
		display: flex;
		height: 100vh;
		overflow: hidden;
	}
	.main-content {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}
</style>

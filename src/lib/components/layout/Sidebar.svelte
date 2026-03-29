<script lang="ts">
	import ChatSidebar from './ChatSidebar.svelte';
</script>

<aside class="w-80 min-w-80 h-screen flex flex-col border-r border-border bg-background">
	<div class="px-4 py-4 border-b border-border">
		<div class="text-sm font-semibold">Creampi</div>
		<div class="text-xs text-muted-foreground mt-1">Simple chat mode</div>
	</div>

	<div class="flex-1 min-h-0 overflow-hidden">
		<ChatSidebar />
	</div>
</aside>

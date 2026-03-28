<script lang="ts">
	import { push } from "svelte-spa-router";
	import { isAuthenticated } from "../lib/stores/auth";
	import { sessionList } from "../lib/stores/sessions";
	import { loadSessionList } from "../lib/sessions/session-service";
	import { onMount } from "svelte";

	let loaded = $state(false);

	onMount(async () => {
		if (!$isAuthenticated) {
			push("/login");
			return;
		}
		try { await loadSessionList(); } catch {}
		loaded = true;
	});
</script>

<div class="w-full h-screen flex flex-col bg-background text-foreground overflow-hidden">
	<div class="flex items-center justify-between border-b border-border shrink-0 px-4 py-2">
		<div class="flex items-center gap-2">
			<button onclick={() => push("/chat")} class="p-2 rounded hover:bg-secondary transition-colors" title="Back to chat">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			<span class="text-base font-semibold">Admin / Observability</span>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-6">
		{#if !loaded}
			<p class="text-muted-foreground">Loading...</p>
		{:else}
			<div class="max-w-4xl mx-auto space-y-8">
				<!-- Session Stats -->
				<section>
					<h2 class="text-lg font-semibold mb-4">Sessions</h2>
					<div class="grid grid-cols-3 gap-4">
						<div class="border border-border rounded-lg p-4">
							<div class="text-2xl font-bold">{$sessionList.length}</div>
							<div class="text-sm text-muted-foreground">Total Sessions</div>
						</div>
						<div class="border border-border rounded-lg p-4">
							<div class="text-2xl font-bold">
								{$sessionList.reduce((sum, s) => sum + s.messageCount, 0)}
							</div>
							<div class="text-sm text-muted-foreground">Total Messages</div>
						</div>
						<div class="border border-border rounded-lg p-4">
							<div class="text-2xl font-bold">
								{$sessionList.length > 0
									? new Date($sessionList[0].lastModified).toLocaleDateString()
									: "N/A"}
							</div>
							<div class="text-sm text-muted-foreground">Last Activity</div>
						</div>
					</div>
				</section>

				<!-- Recent Sessions -->
				<section>
					<h2 class="text-lg font-semibold mb-4">Recent Sessions</h2>
					{#if $sessionList.length === 0}
						<p class="text-muted-foreground">No sessions yet.</p>
					{:else}
						<div class="space-y-2">
							{#each $sessionList.slice(0, 20) as session}
								<div class="flex items-center justify-between border border-border rounded-lg p-3">
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium truncate">{session.title}</div>
										<div class="text-xs text-muted-foreground">
											{session.messageCount} messages &middot;
											{new Date(session.lastModified).toLocaleString()}
										</div>
									</div>
									<button
										onclick={() => push(`/chat?session=${session.id}`)}
										class="text-xs text-primary hover:underline ml-2"
									>
										Open
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</section>

				<!-- Telemetry placeholder -->
				<section>
					<h2 class="text-lg font-semibold mb-4">Telemetry</h2>
					<p class="text-sm text-muted-foreground">
						Client-side events are emitted to the BFF telemetry endpoint when configured.
						Set <code class="text-xs bg-secondary px-1 py-0.5 rounded">VITE_BFF_BASE_URL</code>
						to enable server-side collection.
					</p>
				</section>
			</div>
		{/if}
	</div>
</div>

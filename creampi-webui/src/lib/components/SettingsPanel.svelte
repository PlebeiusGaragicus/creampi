<script lang="ts">
	import { onMount } from "svelte";
	import { getLmStudioBaseUrl, PROVIDER } from "../config/runtime";
	import { discoverLmStudioModels, type DiscoveredModel } from "../api/client";
	import { selectedModel, customProviders, type CustomProviderConfig } from "../stores/settings";

	interface Props { onclose: () => void; }
	let { onclose }: Props = $props();

	let activeTab = $state<"providers" | "models">("providers");
	let discoveredModels = $state<DiscoveredModel[]>([]);
	let discovering = $state(false);
	let lmStudioUrl = $state(getLmStudioBaseUrl() || "http://localhost:1234");

	// Custom provider form
	let showAddProvider = $state(false);
	let newProviderName = $state("");
	let newProviderUrl = $state("");
	let newProviderType = $state<"lmstudio" | "openai-compatible">("lmstudio");

	onMount(async () => {
		await refreshModels();
	});

	async function refreshModels() {
		discovering = true;
		try {
			discoveredModels = await discoverLmStudioModels();
		} catch {
			discoveredModels = [];
		}
		discovering = false;
	}

	function handleSelectModel(model: DiscoveredModel) {
		selectedModel.set({
			id: model.id,
			name: model.name,
			provider: PROVIDER,
			baseUrl: `${lmStudioUrl}/v1`,
			contextWindow: model.contextWindow ?? 8192,
			maxTokens: model.maxTokens ?? 4096,
		});
	}

	function addProvider() {
		if (!newProviderName.trim() || !newProviderUrl.trim()) return;
		const provider: CustomProviderConfig = {
			id: crypto.randomUUID(),
			name: newProviderName.trim(),
			type: newProviderType,
			baseUrl: newProviderUrl.trim(),
		};
		customProviders.update((list) => [...list, provider]);
		newProviderName = "";
		newProviderUrl = "";
		showAddProvider = false;
	}

	function removeProvider(id: string) {
		customProviders.update((list) => list.filter((p) => p.id !== id));
	}
</script>

<div class="flex flex-1 overflow-hidden">
	<!-- Settings sidebar / tabs -->
	<div class="hidden md:flex flex-col w-48 shrink-0 border-r border-border py-4 gap-1 px-2">
		<button
			onclick={() => activeTab = "providers"}
			class="text-left px-3 py-2 rounded-md text-sm transition-colors
				{activeTab === 'providers' ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}"
		>
			Providers
		</button>
		<button
			onclick={() => activeTab = "models"}
			class="text-left px-3 py-2 rounded-md text-sm transition-colors
				{activeTab === 'models' ? 'bg-secondary text-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}"
		>
			Models
		</button>
	</div>

	<!-- Mobile tabs -->
	<div class="md:hidden flex border-b border-border shrink-0 absolute top-14 left-0 right-0 bg-card z-10">
		<button
			onclick={() => activeTab = "providers"}
			class="flex-1 px-3 py-2 text-sm font-medium transition-colors
				{activeTab === 'providers' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}"
		>
			Providers
		</button>
		<button
			onclick={() => activeTab = "models"}
			class="flex-1 px-3 py-2 text-sm font-medium transition-colors
				{activeTab === 'models' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}"
		>
			Models
		</button>
	</div>

	<!-- Content -->
	<div class="flex-1 overflow-y-auto p-6">
		{#if activeTab === "providers"}
			<div class="space-y-6 max-w-xl">
				<div>
					<h3 class="text-sm font-semibold mb-2">Default Provider (LM Studio)</h3>
					<p class="text-sm text-muted-foreground mb-3">
						LM Studio is configured as the default provider. Models are discovered automatically from its API.
					</p>
					<div class="flex items-center gap-2">
						<div class="flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground font-mono">
							{lmStudioUrl || "Not configured"}
						</div>
						<span class="text-xs px-2 py-1 rounded-full {lmStudioUrl ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-500'}">
							{lmStudioUrl ? "configured" : "missing"}
						</span>
					</div>
				</div>

				<div class="border-t border-border pt-4">
					<div class="flex items-center justify-between mb-3">
						<h3 class="text-sm font-semibold">Custom Providers</h3>
						<button
							onclick={() => showAddProvider = !showAddProvider}
							class="text-xs px-2.5 py-1 rounded border border-border hover:bg-secondary transition-colors"
						>
							{showAddProvider ? "Cancel" : "Add Provider"}
						</button>
					</div>

					{#if showAddProvider}
						<div class="space-y-3 p-3 rounded-lg border border-border bg-secondary/30 mb-4">
							<div>
								<label for="provider-name" class="text-xs font-medium text-muted-foreground block mb-1">Name</label>
								<input id="provider-name" bind:value={newProviderName} class="w-full px-3 py-1.5 rounded border border-border bg-background text-sm" placeholder="My Provider" />
							</div>
							<div>
								<label for="provider-type" class="text-xs font-medium text-muted-foreground block mb-1">Type</label>
								<select id="provider-type" bind:value={newProviderType} class="w-full px-3 py-1.5 rounded border border-border bg-background text-sm">
									<option value="lmstudio">LM Studio</option>
									<option value="openai-compatible">OpenAI Compatible</option>
								</select>
							</div>
							<div>
								<label for="provider-url" class="text-xs font-medium text-muted-foreground block mb-1">Base URL</label>
								<input id="provider-url" bind:value={newProviderUrl} class="w-full px-3 py-1.5 rounded border border-border bg-background text-sm" placeholder="http://localhost:1234" />
							</div>
							<button onclick={addProvider} class="px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm hover:opacity-90 transition-opacity">
								Save Provider
							</button>
						</div>
					{/if}

					{#if $customProviders.length === 0}
						<p class="text-sm text-muted-foreground text-center py-4">No custom providers configured.</p>
					{:else}
						<div class="space-y-2">
							{#each $customProviders as provider (provider.id)}
								<div class="flex items-center justify-between p-3 rounded-lg border border-border">
									<div>
										<div class="text-sm font-medium">{provider.name}</div>
										<div class="text-xs text-muted-foreground font-mono">{provider.baseUrl}</div>
									</div>
									<button
										onclick={() => removeProvider(provider.id)}
										class="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
										title="Remove"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
											<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === "models"}
			<div class="space-y-4 max-w-xl">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-semibold">Available Models</h3>
					<button
						onclick={refreshModels}
						disabled={discovering}
						class="text-xs px-2.5 py-1 rounded border border-border hover:bg-secondary transition-colors disabled:opacity-50"
					>
						{discovering ? "Discovering..." : "Refresh"}
					</button>
				</div>

				{#if $selectedModel}
					<div class="p-3 rounded-lg border border-primary/30 bg-primary/5">
						<div class="text-xs text-muted-foreground mb-1">Active model</div>
						<div class="text-sm font-medium">{$selectedModel.id}</div>
						<div class="text-xs text-muted-foreground font-mono mt-0.5">{$selectedModel.provider} &middot; {$selectedModel.baseUrl}</div>
					</div>
				{/if}

				{#if discovering}
					<div class="text-sm text-muted-foreground text-center py-8">Discovering models from LM Studio...</div>
				{:else if discoveredModels.length === 0}
					<div class="text-sm text-muted-foreground text-center py-8">
						No models found. Make sure LM Studio is running.
					</div>
				{:else}
					<div class="space-y-1">
						{#each discoveredModels as model (model.id)}
							<button
								onclick={() => handleSelectModel(model)}
								class="w-full text-left p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors
									{$selectedModel?.id === model.id ? 'border-primary/50 bg-primary/5' : ''}"
							>
								<div class="flex items-center justify-between">
									<span class="text-sm font-medium truncate">{model.id}</span>
									{#if $selectedModel?.id === model.id}
										<span class="text-green-500 text-sm">&#10003;</span>
									{/if}
								</div>
								<div class="text-xs text-muted-foreground mt-0.5">
									{model.contextWindow ? `${Math.round(model.contextWindow / 1024)}K ctx` : ""}{model.maxTokens ? ` / ${Math.round(model.maxTokens / 1024)}K max` : ""}
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

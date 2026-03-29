<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { logout } from '$lib/api/nip98-client';
	import { pubkey } from '$lib/stores/auth';
	import { selectedModel } from '$lib/stores/settings';
	import { discoverModels } from '$lib/api/client';

	let themeToggleLoaded = false;

	interface ServerModel {
		id: string;
		name: string;
		type: string;
		publisher: string;
		arch: string;
		quantization: string;
		state: string;
		contextWindow: number;
		maxTokens: number;
		reasoning: boolean;
		vision: boolean;
		capabilities: string[];
	}

	let serverModels: ServerModel[] = [];
	let lmStudioReachable = false;
	let lmStudioModelCount = 0;
	let modelsLoading = true;

	onMount(async () => {
		if (!browser) return;
		await import('@mariozechner/mini-lit/dist/ThemeToggle.js');
		themeToggleLoaded = true;

		try {
			const [healthRes, modelsRes] = await Promise.all([
				fetch('/api/health').then(r => r.ok ? r.json() : null).catch(() => null),
				discoverModels().catch(() => ({ models: [], defaultModel: undefined })),
			]);

			if (healthRes?.lmStudio) {
				lmStudioReachable = healthRes.lmStudio.reachable;
				lmStudioModelCount = healthRes.lmStudio.models;
			}
			serverModels = modelsRes.models || [];
		} finally {
			modelsLoading = false;
		}
	});

	function selectModel(m: ServerModel) {
		selectedModel.set({
			id: m.id,
			name: m.name || m.id,
			provider: 'creampi-lmstudio',
			baseUrl: '',
			contextWindow: m.contextWindow || 8192,
			maxTokens: m.maxTokens || 4096,
		});
	}

	const shortPubkey = (pk: string | null) =>
		pk ? `${pk.slice(0, 12)}...${pk.slice(-8)}` : 'Not signed in';

	async function handleLogout() {
		await logout();
		goto('/login');
	}
</script>

<div class="h-full overflow-auto bg-background text-foreground">
	<div class="max-w-xl mx-auto p-6 space-y-6">
		<h1 class="text-lg font-semibold">Settings</h1>

		<section class="rounded-lg border border-border p-4 space-y-3">
			<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Appearance</h2>
			<div class="flex items-center justify-between">
				<span class="text-sm">Theme</span>
				{#if themeToggleLoaded}
					<theme-toggle></theme-toggle>
				{:else}
					<span class="text-xs text-muted-foreground">Loading...</span>
				{/if}
			</div>
		</section>

		<section class="rounded-lg border border-border p-4 space-y-3">
			<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Models</h2>

			<div class="rounded-md border border-border bg-secondary/40 px-3 py-2">
				<div class="text-[11px] uppercase tracking-wide text-muted-foreground">LM Studio Server</div>
				{#if modelsLoading}
					<div class="mt-1 text-xs text-muted-foreground">Checking...</div>
				{:else if lmStudioReachable}
					<div class="mt-1 flex items-center gap-2">
						<span class="inline-block w-2 h-2 rounded-full bg-green-500"></span>
						<span class="text-xs text-foreground">Connected &middot; {lmStudioModelCount} model{lmStudioModelCount !== 1 ? 's' : ''}</span>
					</div>
				{:else}
					<div class="mt-1 flex items-center gap-2">
						<span class="inline-block w-2 h-2 rounded-full bg-red-500"></span>
						<span class="text-xs text-muted-foreground">Unreachable</span>
					</div>
				{/if}
			</div>

			{#if $selectedModel}
				<div class="rounded-md border border-border bg-secondary/40 px-3 py-2">
					<div class="text-[11px] uppercase tracking-wide text-muted-foreground">Selected Model</div>
					<div class="mt-1 text-xs text-foreground font-mono">{$selectedModel.id}</div>
				</div>
			{/if}

			{#if !modelsLoading && serverModels.length > 0}
				<div class="space-y-1.5">
					{#each serverModels as m}
						<button
							class="w-full rounded-md border px-3 py-2.5 text-left text-sm transition
								{$selectedModel?.id === m.id
									? 'border-primary bg-primary/10 text-foreground'
									: 'border-border bg-background text-foreground hover:bg-accent'}"
							onclick={() => selectModel(m)}
						>
							<div class="flex items-center justify-between">
								<span class="font-mono text-xs">{m.id}</span>
								{#if m.state === 'loaded'}
									<span class="inline-flex items-center gap-1 text-[10px] text-green-500 font-medium">
										<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
										loaded
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
								<span>ctx {m.contextWindow >= 1_000_000 ? `${(m.contextWindow / 1_000_000).toFixed(0)}M` : m.contextWindow >= 1000 ? `${Math.round(m.contextWindow / 1000)}K` : m.contextWindow}</span>
								<span>&middot;</span>
								<span>max {m.maxTokens >= 1000 ? `${Math.round(m.maxTokens / 1000)}K` : m.maxTokens}</span>
								{#if m.quantization}
									<span>&middot;</span>
									<span>{m.quantization}</span>
								{/if}
							</div>
							<div class="flex items-center gap-2 mt-1">
								<span class="inline-flex items-center gap-0.5 text-[10px] {m.reasoning ? 'text-purple-500' : 'text-muted-foreground/40'}">
									<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 5.5 4 7v3h8v-3c2.5-1.5 4-4 4-7a8 8 0 0 0-8-8z"/></svg>
									reasoning
								</span>
								<span class="inline-flex items-center gap-0.5 text-[10px] {m.vision ? 'text-blue-500' : 'text-muted-foreground/40'}">
									<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
									vision
								</span>
								{#if m.capabilities?.includes('tool_use')}
									<span class="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
										<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
										tools
									</span>
								{/if}
							</div>
						</button>
					{/each}
				</div>
			{:else if !modelsLoading}
				<p class="text-xs text-muted-foreground">No models found. Make sure LM Studio is running and has models loaded.</p>
			{/if}
		</section>

		<section class="rounded-lg border border-border p-4 space-y-3">
			<h2 class="text-sm font-medium text-muted-foreground uppercase tracking-wide">Account</h2>
			<div class="rounded-md border border-border bg-secondary/40 px-3 py-2">
				<div class="text-[11px] uppercase tracking-wide text-muted-foreground">Pubkey</div>
				<div class="mt-1 text-xs text-foreground break-all font-mono">{shortPubkey($pubkey)}</div>
			</div>
			<button
				class="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-accent transition disabled:opacity-60 disabled:cursor-not-allowed"
				onclick={handleLogout}
				disabled={!$pubkey}
			>
				Log out
			</button>
		</section>
	</div>
</div>

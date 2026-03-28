<script lang="ts">
	import { onMount, tick } from "svelte";
	import { push, router } from "svelte-spa-router";
	import { isAuthenticated, pubkey } from "../lib/stores/auth";
	import { currentSessionId, currentTitle, isEditingTitle, sessionList } from "../lib/stores/sessions";
	import { chatPanelStore } from "../lib/stores/agent";
	import { initStorage } from "../lib/pi/storage";
	import { createAgent, getOrCreateChatPanel, getLastSessionId, rememberLastSession } from "../lib/pi/create-agent";
	import {
		getSessionData,
		getSessionMeta,
		updateSessionTitle,
		resetSession,
		loadSessionList,
		deleteSession,
	} from "../lib/sessions/session-service";
	import { sessionFiles, loadSessionFiles, type SessionFile } from "../lib/stores/files";
	import { logout } from "../lib/auth/nip98-client";
	import { emitAuthEvent } from "../lib/observability/events";
	import SettingsPanel from "../lib/components/SettingsPanel.svelte";
	import "@mariozechner/mini-lit/dist/ThemeToggle.js";

	let chatContainer = $state<HTMLDivElement>(undefined!);
	let loading = $state(true);
	let titleInput = $state("");
	let settingsOpen = $state(false);
	let sidebarExpanded = $state(
		typeof localStorage !== "undefined"
			? localStorage.getItem("creampi_sidebar") !== "collapsed"
			: true
	);
	let mobileDrawerOpen = $state(false);

	function toggleSidebar() {
		sidebarExpanded = !sidebarExpanded;
		try { localStorage.setItem("creampi_sidebar", sidebarExpanded ? "expanded" : "collapsed"); } catch {}
	}

	function formatFileSize(bytes: number): string {
		if (bytes < 1024) return `${bytes}B`;
		if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
		return `${(bytes / 1048576).toFixed(1)}MB`;
	}

	function formatRelativeDate(iso: string): string {
		const d = new Date(iso);
		const now = new Date();
		const diff = now.getTime() - d.getTime();
		const days = Math.floor(diff / 86400000);
		if (days === 0) return "Today";
		if (days === 1) return "Yesterday";
		if (days < 7) return `${days}d ago`;
		return d.toLocaleDateString();
	}

	async function boot() {
		const storage = await initStorage();
		const chatPanel = getOrCreateChatPanel();

		const qs = router.querystring ?? "";
		const params = new URLSearchParams(qs);
		const sessionId = params.get("session") || getLastSessionId();

		if (sessionId) {
			const data = await getSessionData(sessionId);
			if (data) {
				currentSessionId.set(sessionId);
				rememberLastSession(sessionId);
				const meta = await getSessionMeta(sessionId);
				currentTitle.set(meta?.title || "");
				window.location.hash = `#/chat?session=${sessionId}`;
				await createAgent(chatPanel, storage, {
					model: data.model,
					thinkingLevel: data.thinkingLevel,
					messages: data.messages,
					tools: [],
				});
			} else {
				await createAgent(chatPanel, storage);
			}
		} else {
			await createAgent(chatPanel, storage);
		}

		await loadSessionList();
		if (sessionId) loadSessionFiles(sessionId);

		loading = false;
		await tick();
		if (chatContainer && !chatContainer.contains(chatPanel)) {
			chatPanel.style.flex = "1 1 0%";
			chatPanel.style.minHeight = "0";
			chatPanel.style.overflow = "hidden";
			chatContainer.appendChild(chatPanel);
		}
	}

	onMount(async () => {
		await boot();
	});

	function handleNewSession() {
		resetSession();
		window.location.hash = "#/chat";
		window.location.reload();
	}

	function handleSelectSession(sid: string) {
		resetSession();
		window.location.hash = `#/chat?session=${sid}`;
		window.location.reload();
	}

	async function handleDeleteSession(sid: string, ev: MouseEvent) {
		ev.stopPropagation();
		if (!confirm("Delete this session?")) return;
		await deleteSession(sid);
		if (sid === $currentSessionId) handleNewSession();
	}

	async function handleTitleSave() {
		const v = titleInput.trim();
		if (v && v !== $currentTitle && $currentSessionId) {
			await updateSessionTitle($currentSessionId, v);
		}
		isEditingTitle.set(false);
	}

	function handleTitleKeydown(e: KeyboardEvent) {
		if (e.key === "Enter") handleTitleSave();
		else if (e.key === "Escape") isEditingTitle.set(false);
	}

	function handleLogout() {
		emitAuthEvent("logout", $pubkey ?? undefined);
		logout();
		push("/login");
	}
</script>

{#if loading}
	<div class="w-full h-screen flex items-center justify-center bg-background text-foreground">
		<div class="text-muted-foreground">Loading...</div>
	</div>
{:else}
	<!-- Mobile drawer backdrop -->
	{#if mobileDrawerOpen}
		<button
			class="fixed inset-0 bg-black/50 z-40 md:hidden"
			onclick={() => mobileDrawerOpen = false}
			aria-label="Close sidebar"
		></button>
	{/if}

	<div class="w-full h-screen flex bg-background text-foreground overflow-hidden">
		<!-- Sidebar -->
		<aside
			class="shrink-0 h-full flex flex-col border-r border-border bg-card transition-all duration-200 z-50
				{sidebarExpanded ? 'w-64' : 'w-14'}
				max-md:fixed max-md:inset-y-0 max-md:left-0
				{mobileDrawerOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'}"
		>
			<!-- Sidebar header -->
			<div class="flex items-center justify-between shrink-0 border-b border-border px-2 py-2 gap-1">
				{#if sidebarExpanded}
					<button
						onclick={handleNewSession}
						class="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary transition-colors truncate"
						title="New Session"
					>
						<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						New chat
					</button>
				{/if}
				<button
					onclick={toggleSidebar}
					class="p-2 rounded hover:bg-secondary transition-colors shrink-0"
					title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						{#if sidebarExpanded}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7" />
						{:else}
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7" />
						{/if}
					</svg>
				</button>
			</div>

			{#if !sidebarExpanded}
				<div class="flex flex-col items-center gap-1 py-2">
					<button onclick={handleNewSession} class="p-2 rounded hover:bg-secondary transition-colors" title="New Session">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
					</button>
				</div>
			{/if}

			<!-- Session list (expanded only) -->
			{#if sidebarExpanded}
				<div class="flex-1 overflow-y-auto">
					<div class="px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sessions</div>
					{#if $sessionList.length === 0}
						<div class="px-3 py-4 text-sm text-muted-foreground text-center">No sessions yet</div>
					{:else}
						<div class="space-y-0.5 px-1">
							{#each $sessionList as session (session.id)}
								<div
									role="button"
									tabindex="0"
									onclick={() => handleSelectSession(session.id)}
									onkeydown={(e: KeyboardEvent) => { if (e.key === 'Enter') handleSelectSession(session.id); }}
									class="group w-full text-left px-2 py-2 rounded-md transition-colors flex items-start gap-2 cursor-pointer
										{session.id === $currentSessionId ? 'bg-secondary text-foreground' : 'hover:bg-secondary/50 text-foreground'}"
								>
									<div class="flex-1 min-w-0">
										<div class="text-sm truncate font-medium">{session.title}</div>
										<div class="text-xs text-muted-foreground mt-0.5">
											{formatRelativeDate(session.lastModified)} &middot; {session.messageCount} msgs
										</div>
									</div>
									<button
										onclick={(ev: MouseEvent) => handleDeleteSession(session.id, ev)}
										class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-opacity shrink-0"
										title="Delete"
									>
										<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
											<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Files section -->
					{#if $currentSessionId}
						<div class="border-t border-border mt-2">
							<div class="px-2 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Files</div>
							{#if $sessionFiles.length === 0}
								<div class="px-3 py-2 text-sm text-muted-foreground text-center">No files</div>
							{:else}
								<div class="space-y-0.5 px-1">
									{#each $sessionFiles as file (file.id)}
										<div class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-secondary/50 transition-colors">
											<svg class="w-3.5 h-3.5 shrink-0 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
												<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
												<polyline points="14 2 14 8 20 8" />
											</svg>
											<span class="truncate flex-1">{file.name}</span>
											<span class="text-xs text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- Sidebar footer -->
			{#if sidebarExpanded}
				<div class="shrink-0 border-t border-border px-2 py-2">
					<button
						onclick={() => settingsOpen = true}
						class="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-secondary transition-colors text-muted-foreground"
						title="Settings"
					>
						<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<circle cx="12" cy="12" r="3" />
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
						</svg>
						Settings
					</button>
				</div>
			{:else}
				<div class="shrink-0 border-t border-border flex flex-col items-center py-2">
					<button
						onclick={() => settingsOpen = true}
						class="p-2 rounded hover:bg-secondary transition-colors text-muted-foreground"
						title="Settings"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<circle cx="12" cy="12" r="3" />
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
						</svg>
					</button>
				</div>
			{/if}
		</aside>

		<!-- Main content -->
		<div class="flex-1 flex flex-col min-w-0 overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-border shrink-0 px-4 py-2">
				<div class="flex items-center gap-2">
					<button
						onclick={() => mobileDrawerOpen = true}
						class="p-2 rounded hover:bg-secondary transition-colors md:hidden"
						title="Menu"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
						</svg>
					</button>

					{#if $currentTitle}
						{#if $isEditingTitle}
							<input
								type="text"
								bind:value={titleInput}
								onkeydown={handleTitleKeydown}
								onblur={handleTitleSave}
								class="text-sm w-64 px-2 py-1 border border-border rounded bg-background text-foreground"
							/>
						{:else}
							<button
								onclick={() => { titleInput = $currentTitle; isEditingTitle.set(true); }}
								class="px-2 py-1 text-sm text-foreground hover:bg-secondary rounded transition-colors"
								title="Click to edit title"
							>
								{$currentTitle}
							</button>
						{/if}
					{:else}
						<span class="text-base font-semibold text-foreground">Creampi</span>
					{/if}
				</div>

				<div class="flex items-center gap-1">
					{#if $pubkey}
						<span class="text-xs text-muted-foreground font-mono">
							{$pubkey.slice(0, 8)}...
						</span>
					{/if}
					<theme-toggle></theme-toggle>
					{#if $isAuthenticated}
						<button
							onclick={handleLogout}
							class="p-2 rounded hover:bg-secondary transition-colors text-sm"
							title="Logout"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
									d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
							</svg>
						</button>
					{/if}
				</div>
			</div>

			<!-- Chat Panel container -->
			<div bind:this={chatContainer} class="flex flex-col flex-1 min-h-0 overflow-hidden"></div>
		</div>
	</div>

	<!-- Settings Modal -->
	{#if settingsOpen}
		<div class="fixed inset-0 z-[100] flex items-center justify-center">
			<button class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick={() => settingsOpen = false} aria-label="Close settings"></button>
			<div class="relative bg-card border border-border rounded-xl shadow-2xl w-[min(900px,90vw)] h-[min(700px,85vh)] flex flex-col overflow-hidden">
				<div class="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
					<h2 class="text-lg font-semibold">Settings</h2>
					<button onclick={() => settingsOpen = false} class="p-1.5 rounded hover:bg-secondary transition-colors" title="Close">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>
				<SettingsPanel onclose={() => settingsOpen = false} />
			</div>
		</div>
	{/if}
{/if}

<script lang="ts">
	import { push } from "svelte-spa-router";
	import { isAuthenticated } from "../lib/stores/auth";
	import { hasNostrExtension, loginWithNip98 } from "../lib/auth/nip98-client";
	import { emitAuthEvent } from "../lib/observability/events";

	let loggingIn = $state(false);
	let error = $state("");

	$effect(() => {
		if ($isAuthenticated) push("/chat");
	});

	async function handleLogin() {
		error = "";
		loggingIn = true;
		try {
			const ok = await loginWithNip98();
			if (ok) {
				emitAuthEvent("login");
				push("/chat");
			} else {
				error = "Login failed. Please try again.";
				emitAuthEvent("login_failed");
			}
		} catch (e: any) {
			error = e.message || "Login failed";
			emitAuthEvent("login_failed");
		} finally {
			loggingIn = false;
		}
	}
</script>

<div class="w-full h-screen flex items-center justify-center bg-background text-foreground">
	<div class="flex flex-col items-center gap-6 max-w-sm w-full px-6">
		<h1 class="text-3xl font-bold">Creampi</h1>
		<p class="text-muted-foreground text-center text-sm">
			Sign in with your Nostr identity to continue.
		</p>

		{#if !hasNostrExtension()}
			<div class="text-sm text-destructive text-center p-4 border border-destructive/30 rounded-lg">
				No Nostr extension detected. Install a NIP-07 compatible extension
				(e.g. nos2x, Alby) to sign in.
			</div>
		{:else}
			<button
				onclick={handleLogin}
				disabled={loggingIn}
				class="w-full py-3 px-4 rounded-lg font-medium transition-colors
					bg-primary text-primary-foreground hover:bg-primary/90
					disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{loggingIn ? "Signing in..." : "Sign in with Nostr"}
			</button>
		{/if}

		{#if error}
			<div class="text-sm text-destructive">{error}</div>
		{/if}

		<button
			onclick={() => push("/chat")}
			class="text-xs text-muted-foreground hover:text-foreground transition-colors"
		>
			Continue without login (dev mode)
		</button>
	</div>
</div>

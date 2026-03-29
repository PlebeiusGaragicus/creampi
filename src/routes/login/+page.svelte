<script lang="ts">
	import { goto } from '$app/navigation';
	import { isAuthenticated } from '$lib/stores/auth';
	import { getNostrExtensionStatus, loginWithNip98 } from '$lib/api/nip98-client';
	import { emitAuthEvent } from '$lib/api/events';

	let loggingIn = false;
	let error = '';

	$: if ($isAuthenticated) goto('/chat');
	$: extensionStatus = getNostrExtensionStatus();
	$: extensionReady = extensionStatus === 'available';

	async function handleLogin() {
		error = '';
		loggingIn = true;
		try {
			const result = await loginWithNip98();
			if (result.ok) {
				emitAuthEvent('login');
				goto('/chat');
			} else {
				error = result.errorMessage || 'Login failed. Please try again.';
				emitAuthEvent('login_failed');
			}
		} catch (e: any) {
			error = e.message || 'Login failed';
			emitAuthEvent('login_failed');
		} finally {
			loggingIn = false;
		}
	}
</script>

<div class="min-h-screen bg-background text-foreground grid place-items-center p-6">
	<div class="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
		<div class="mb-6">
			<h1 class="text-2xl font-semibold tracking-tight">Creampi</h1>
			<p class="mt-2 text-sm text-muted-foreground">
				Simple chat powered by pi-agent. Sign in with your Nostr identity to continue.
			</p>
		</div>

		{#if !extensionReady}
			<div class="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
				No Nostr extension detected (NIP-07). Install or enable one (for example Alby or nos2x), then reload.
			</div>
		{:else}
			<button
				class="w-full rounded-md border border-border bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-60 disabled:cursor-not-allowed"
				onclick={handleLogin}
				disabled={loggingIn}
			>
				{loggingIn ? 'Signing in...' : 'Sign in with Nostr'}
			</button>
		{/if}

		{#if error}
			<div class="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
				{error}
			</div>
		{/if}
	</div>
</div>

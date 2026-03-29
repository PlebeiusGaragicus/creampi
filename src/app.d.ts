// See https://svelte.dev/docs/kit/types

declare global {
	namespace App {
		interface Locals {
			pubkey?: string;
		}
	}

	interface Window {
		nostr?: {
			getPublicKey(): Promise<string>;
			signEvent(event: any): Promise<any>;
		};
	}
}

export {};

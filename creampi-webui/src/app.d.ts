/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_LM_STUDIO_BASE_URL: string;
	readonly VITE_LM_STUDIO_MODEL_ID: string;
	readonly VITE_LM_STUDIO_API_KEY: string;
	readonly VITE_BFF_BASE_URL: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

interface Window {
	nostr?: {
		getPublicKey(): Promise<string>;
		signEvent(event: any): Promise<any>;
		nip04?: {
			encrypt(pubkey: string, plaintext: string): Promise<string>;
			decrypt(pubkey: string, ciphertext: string): Promise<string>;
		};
	};
}

import { join } from 'node:path';
import { homedir } from 'node:os';
import { env as svelteEnv } from '$env/dynamic/private';

function env(key: string, fallback: string): string {
	return svelteEnv[key] ?? fallback;
}

function expandHome(p: string): string {
	return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

export const config = {
	host: env('HOST', '127.0.0.1'),
	port: Number.parseInt(env('PORT', '5173'), 10),
	dataDir: expandHome(env('DATA_DIR', '~/.local/share/creampi')),
	lmStudio: {
		baseUrl: env('LM_STUDIO_BASE_URL', 'http://bot.local:2345'),
		defaultModel: env('LM_STUDIO_DEFAULT_MODEL', ''),
		apiKey: env('LM_STUDIO_API_KEY', '')
	},
	sandbox: {
		mode: env('SANDBOX_MODE', 'direct') as 'direct' | 'nspawn',
		baseImage: env('NSPAWN_BASE_IMAGE', '/var/lib/machines/creampi-base'),
		bridge: env('NSPAWN_BRIDGE', 'creampi'),
		cubiclesDir: expandHome(env('CUBICLES_DIR', '~/cubicles'))
	},
	integrations: {
		ntfyBaseUrl: env('NTFY_BASE_URL', ''),
		ntfyTopic: env('NTFY_TOPIC', 'creampi'),
		strfryRelayUrl: env('STRFRY_RELAY_URL', ''),
		giteaBaseUrl: env('GITEA_BASE_URL', '')
	}
} as const;

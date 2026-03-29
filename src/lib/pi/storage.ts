import {
	AppStorage,
	CustomProvidersStore,
	IndexedDBStorageBackend,
	ProviderKeysStore,
	SessionsStore,
	SettingsStore,
	setAppStorage,
	getAppStorage,
} from "@mariozechner/pi-web-ui";

const LMSTUDIO_PROVIDER_ID = "creampi-lmstudio";
export const LMSTUDIO_PROVIDER_NAME = "LM Studio";

let initialized = false;

export async function initStorage(): Promise<AppStorage> {
	if (initialized) return getAppStorage();

	const settings = new SettingsStore();
	const providerKeys = new ProviderKeysStore();
	const sessions = new SessionsStore();
	const customProviders = new CustomProvidersStore();

	const backend = new IndexedDBStorageBackend({
		dbName: "creampi-webui",
		version: 2,
		stores: [
			settings.getConfig(),
			SessionsStore.getMetadataConfig(),
			providerKeys.getConfig(),
			sessions.getConfig(),
			customProviders.getConfig(),
		],
	});

	settings.setBackend(backend);
	providerKeys.setBackend(backend);
	sessions.setBackend(backend);
	customProviders.setBackend(backend);

	const storage = new AppStorage(settings, providerKeys, sessions, customProviders, backend);
	setAppStorage(storage);

	await registerServerModels(customProviders);

	initialized = true;
	return storage;
}

async function registerServerModels(customProviders: CustomProvidersStore) {
	try {
		const { discoverModels } = await import("$lib/api/client");
		const { models } = await discoverModels();
		if (models.length > 0) {
			await customProviders.set({
				id: LMSTUDIO_PROVIDER_ID,
				name: LMSTUDIO_PROVIDER_NAME,
				type: "openai-compat" as any,
				baseUrl: "",
				models: models.map((m: any) => ({
					id: m.id,
					name: m.name || m.id,
					api: "openai-completions",
					provider: LMSTUDIO_PROVIDER_NAME,
					baseUrl: "",
					reasoning: !!m.reasoning,
					input: m.vision ? ["text", "image"] : ["text"],
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
					contextWindow: m.contextWindow || 8192,
					maxTokens: m.maxTokens || 4096,
				})),
			} as any);
		}
	} catch {
		// Server unreachable -- models will show as empty until next init
	}
}

export { getAppStorage };

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
import { getLmApiKey, PROVIDER } from "../config/runtime";

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

	await providerKeys.set(PROVIDER, getLmApiKey());

	initialized = true;
	return storage;
}

export { getAppStorage };

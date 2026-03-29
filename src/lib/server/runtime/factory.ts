import { config } from '../config';
import type { RuntimeAdapter } from './types';
import { EmbeddedAdapter } from './embedded-adapter';
import { NspawnAdapter } from './nspawn-adapter';

let embedded: RuntimeAdapter | null = null;
let nspawn: RuntimeAdapter | null = null;

export function getComputerRuntime(): RuntimeAdapter {
	if (config.sandbox.mode === 'nspawn') {
		if (!nspawn) nspawn = new NspawnAdapter();
		return nspawn;
	}
	if (!embedded) embedded = new EmbeddedAdapter();
	return embedded;
}

export async function shutdownRuntimes(): Promise<void> {
	if (embedded) {
		await embedded.shutdown();
		embedded = null;
	}
	if (nspawn) {
		await nspawn.shutdown();
		nspawn = null;
	}
}

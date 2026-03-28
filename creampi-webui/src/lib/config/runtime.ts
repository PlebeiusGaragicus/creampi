import type { Model } from "@mariozechner/pi-ai";

export const PROVIDER = "creampi-lmstudio";

function requireEnv(key: string): string {
	const value = import.meta.env[key];
	if (!value) throw new Error(`Missing required env var: ${key}. See .env.example.`);
	return value;
}

export function getLmModel(): Model<"openai-completions"> {
	const baseUrl = requireEnv("VITE_LM_STUDIO_BASE_URL").replace(/\/+$/, "");
	const modelId = requireEnv("VITE_LM_STUDIO_MODEL_ID");

	return {
		id: modelId,
		name: modelId,
		api: "openai-completions",
		provider: PROVIDER,
		baseUrl: `${baseUrl}/v1`,
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 8192,
		maxTokens: 4096,
	};
}

export function getLmApiKey(): string {
	return import.meta.env.VITE_LM_STUDIO_API_KEY ?? "";
}

export function getBffBaseUrl(): string {
	return import.meta.env.VITE_BFF_BASE_URL ?? "";
}

export function getLmStudioBaseUrl(): string {
	try {
		return requireEnv("VITE_LM_STUDIO_BASE_URL").replace(/\/+$/, "");
	} catch {
		return "";
	}
}

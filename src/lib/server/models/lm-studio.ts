import { config } from "../config";

export type ModelType = "llm" | "vlm" | "embeddings";
export type ModelState = "loaded" | "not-loaded";

export interface DiscoveredModel {
	id: string;
	name: string;
	type: ModelType;
	publisher: string;
	arch: string;
	quantization: string;
	state: ModelState;
	contextWindow: number;
	maxTokens: number;
	reasoning: boolean;
	vision: boolean;
	capabilities: string[];
}

const REASONING_PATTERNS = [
	/qwen3/i,
	/deepseek.*r1/i,
	/nemotron/i,
	/phi-?4/i,
	/gemma-?3/i,
];

function inferReasoning(id: string, arch: string): boolean {
	const combined = `${id} ${arch}`;
	return REASONING_PATTERNS.some(p => p.test(combined));
}

function estimateMaxTokens(contextWindow: number): number {
	return Math.min(Math.floor(contextWindow / 4), 32768);
}

let cachedModels: DiscoveredModel[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

export async function discoverModels(): Promise<DiscoveredModel[]> {
	if (cachedModels && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
		return cachedModels;
	}

	const baseUrl = config.lmStudio.baseUrl.replace(/\/+$/, "");
	const headers: Record<string, string> = {};
	if (config.lmStudio.apiKey) {
		headers["Authorization"] = `Bearer ${config.lmStudio.apiKey}`;
	}

	const res = await fetch(`${baseUrl}/api/v0/models`, {
		headers,
		signal: AbortSignal.timeout(5000),
	});
	if (!res.ok) {
		throw new Error(`LM Studio returned ${res.status}`);
	}

	const data = await res.json();
	if (!data.data || !Array.isArray(data.data)) {
		throw new Error("Unexpected LM Studio response format");
	}

	cachedModels = data.data
		.filter((m: any) => m.type !== "embeddings")
		.map((m: any) => {
			const contextWindow = m.loaded_context_length || m.max_context_length || 8192;
			const capabilities: string[] = m.capabilities ?? [];
			const isVlm = m.type === "vlm";

			return {
				id: m.id,
				name: m.id,
				type: m.type as ModelType,
				publisher: m.publisher ?? "",
				arch: m.arch ?? "",
				quantization: m.quantization ?? "",
				state: (m.state ?? "not-loaded") as ModelState,
				contextWindow,
				maxTokens: estimateMaxTokens(contextWindow),
				reasoning: inferReasoning(m.id, m.arch ?? ""),
				vision: isVlm,
				capabilities,
			};
		});
	cacheTimestamp = Date.now();

	return cachedModels!;
}

export async function checkHealth(): Promise<{ reachable: boolean; models: number }> {
	try {
		const models = await discoverModels();
		return { reachable: true, models: models.length };
	} catch {
		return { reachable: false, models: 0 };
	}
}

export function getDefaultModelId(): string {
	return config.lmStudio.defaultModel;
}

export function invalidateCache(): void {
	cachedModels = null;
	cacheTimestamp = 0;
}

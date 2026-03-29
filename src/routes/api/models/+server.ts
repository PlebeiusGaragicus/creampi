import { json, type RequestHandler } from '@sveltejs/kit';
import { discoverModels, getDefaultModelId } from '$lib/server/models/lm-studio';

export const GET: RequestHandler = async () => {
	try {
		const models = await discoverModels();
		return json({ models, defaultModel: getDefaultModelId() });
	} catch (err) {
		return json(
			{ error: 'ServiceUnavailable', message: `LM Studio unreachable: ${err instanceof Error ? err.message : String(err)}` },
			{ status: 503 }
		);
	}
};

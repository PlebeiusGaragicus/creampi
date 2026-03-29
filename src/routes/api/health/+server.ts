import { json, type RequestHandler } from '@sveltejs/kit';
import { checkHealth } from '$lib/server/models/lm-studio';

export const GET: RequestHandler = async () => {
	const lmStudio = await checkHealth();
	return json({ status: 'ok', lmStudio });
};

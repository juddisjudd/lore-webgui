import { load as request } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { server } = await parent();
	return {
		repositories: server?.reachable ? await request((client) => client.repositories.list()) : []
	};
};

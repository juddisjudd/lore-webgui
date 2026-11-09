import { load as request } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { repo, branch } = await parent();
	return {
		page: await request((client) =>
			client.branches.history({ params: { repo: repo.id, branch: branch.id }, query: {} })
		)
	};
};

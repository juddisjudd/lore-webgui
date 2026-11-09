import { load as request } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent, url }) => {
	const { repo } = await parent();
	const against = url.searchParams.get('against');
	const [revision, changes] = await Promise.all([
		request((client) => client.revisions.get({ params: { repo: repo.id, signature: params.sig } })),
		request((client) =>
			client.revisions.changes({
				params: { repo: repo.id, signature: params.sig },
				query: against ? { against } : {}
			})
		)
	]);
	return { revision, changes };
};

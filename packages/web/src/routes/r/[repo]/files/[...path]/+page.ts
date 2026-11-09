import { load as request } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
	const { repo, ref } = await parent();
	const path = params.path;
	if (!ref) return { path, listing: null, revision: null };
	const signature = ref;
	const [listing, revision] = await Promise.all([
		request((client) =>
			client.revisions.tree({ params: { repo: repo.id, signature }, query: path ? { path } : {} })
		),
		request((client) => client.revisions.get({ params: { repo: repo.id, signature } }))
	]);
	return { path, listing, revision };
};

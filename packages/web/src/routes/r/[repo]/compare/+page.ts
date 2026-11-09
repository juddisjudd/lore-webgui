import { load as request } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url }) => {
	const { repo, branches } = await parent();
	const live = branches.filter((b) => !b.deleted);
	const base = url.searchParams.get('base') ?? repo.defaultBranchName;
	const head = url.searchParams.get('head') ?? live.find((b) => b.name !== base)?.name ?? base;
	const comparison = await request((client) =>
		client.repositories.compare({ params: { repo: repo.id }, query: { base, head } })
	);
	return { comparison };
};

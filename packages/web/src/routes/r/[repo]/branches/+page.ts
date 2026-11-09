import { load as request } from '#lib/api.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url }) => {
	const { repo, branches } = await parent();
	const showDeleted = url.searchParams.get('deleted') === '1';
	return {
		showDeleted,
		all: showDeleted
			? await request((client) => client.branches.list({ params: { repo: repo.id }, query: { includeDeleted: true } }))
			: branches
	};
};

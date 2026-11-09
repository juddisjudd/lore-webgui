import { error } from '@sveltejs/kit';
import { load as request } from '#lib/api.ts';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params, url }) => {
	const [repo, branches] = await Promise.all([
		request((client) => client.repositories.get({ params: { repo: params.repo } })),
		request((client) => client.branches.list({ params: { repo: params.repo }, query: {} }))
	]);
	const branchName = url.searchParams.get('branch') ?? repo.defaultBranchName;
	const branch = branches.find((b) => b.name === branchName) ?? branches.find((b) => b.id === repo.defaultBranchId);
	if (!branch) error(404, `Branch ${branchName} not found`);
	const rev = url.searchParams.get('rev');
	return { repo, branches, branch, rev, ref: rev ?? branch.latest };
};

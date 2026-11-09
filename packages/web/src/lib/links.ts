export interface RefQuery {
	readonly branch?: string | null | undefined;
	readonly rev?: string | null | undefined;
}

export function withRef(path: string, ref: RefQuery): string {
	const query = new URLSearchParams();
	if (ref.branch) query.set('branch', ref.branch);
	if (ref.rev) query.set('rev', ref.rev);
	const search = query.toString();
	return search ? `${path}?${search}` : path;
}

export const filesPath = (repo: string, path = '') =>
	`/r/${repo}/files${path ? `/${path.split('/').map(encodeURIComponent).join('/')}` : ''}`;

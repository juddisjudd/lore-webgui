import { redirect } from '@sveltejs/kit';
import { load as request } from '#lib/api.ts';
import { gate } from '#lib/auth.ts';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = async ({ url, untrack }) => {
	const auth = await request((client) => client.auth.status());
	const [path, next] = untrack(() => [url.pathname, url.pathname + url.search]);
	const target = gate(auth, path, next);
	if (target) redirect(307, target);
	const signedIn = auth.mode === 'off' || (auth.user !== null && !auth.user.mustChangePassword);
	const server = signedIn ? await request((client) => client.system.server()) : null;
	return { auth, server };
};

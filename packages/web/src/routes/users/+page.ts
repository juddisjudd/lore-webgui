import { error } from '@sveltejs/kit';
import { load as request } from '#lib/api.ts';
import { can } from '#lib/auth.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { auth } = await parent();
	if (auth.mode === 'off') error(404, 'Accounts are turned off on this gateway.');
	if (!can(auth, 'admin')) error(403, 'Only admins can manage users.');
	return { users: await request((client) => client.users.list()) };
};

import { load as request } from '#lib/api.ts';
import type { LayoutLoad } from './$types';

export const ssr = false;

export const load: LayoutLoad = async () => ({
	server: await request((client) => client.system.server())
});

import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
	redirect(307, `/r/${params.repo}/files${url.search}`);
};

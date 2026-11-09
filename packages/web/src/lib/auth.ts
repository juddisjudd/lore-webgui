import type { AuthStatus, Role } from '@lore-webui/api';

const rank: Record<Role, number> = { viewer: 0, member: 1, admin: 2 };

export const can = (auth: AuthStatus, role: Role) =>
	auth.mode === 'off' || (auth.user !== null && rank[auth.user.role] >= rank[role]);

const ENTRY_PAGES = ['/login', '/setup'];

export function gate(auth: AuthStatus, path: string, next: string): string | null {
	if (auth.mode === 'off') return ENTRY_PAGES.includes(path) ? '/' : null;
	if (auth.setupRequired) return path === '/setup' ? null : '/setup';
	if (!auth.user) {
		if (path === '/login') return null;
		return next === '/' ? '/login' : `/login?${new URLSearchParams({ next })}`;
	}
	if (auth.user.mustChangePassword) return path === '/account' ? null : '/account';
	return ENTRY_PAGES.includes(path) ? '/' : null;
}

export function generatePassword(length = 20): string {
	const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const segment = /^[A-Za-z0-9_.-]+$/;

export function nameProblem(value: string, what: string): string | null {
	const name = value.trim();
	if (name === '') return null;
	const parts = name.split('/');
	if (parts.some((part) => part === '')) return `${what} names can't have empty segments or a leading or trailing /.`;
	if (parts.some((part) => part.startsWith('.'))) return `A segment can't start with a dot.`;
	if (parts.some((part) => !segment.test(part))) return `Use letters, digits, -, _ and . separated by /.`;
	return null;
}

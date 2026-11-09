const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const day = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
	['year', 365 * 24 * 3600],
	['month', 30 * 24 * 3600],
	['week', 7 * 24 * 3600],
	['day', 24 * 3600],
	['hour', 3600],
	['minute', 60]
];

export function ago(epochMs: number, now = Date.now()): string {
	const seconds = Math.round((epochMs - now) / 1000);
	for (const [unit, size] of units) {
		if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
	}
	return 'just now';
}

export const when = (epochMs: number) => absolute.format(epochMs);

export const dayLabel = (epochMs: number) => day.format(epochMs);

export const dayKey = (epochMs: number) => new Date(epochMs).toDateString();

export function bytes(size: number): string {
	if (size < 1024) return `${size} B`;
	const scale = ['KB', 'MB', 'GB', 'TB'];
	let value = size / 1024;
	let index = 0;
	while (value >= 1024 && index < scale.length - 1) {
		value /= 1024;
		index++;
	}
	return `${value.toFixed(value < 10 ? 1 : 0)} ${scale[index]}`;
}

export const short = (hex: string, length = 10) => hex.slice(0, length);

export const firstLine = (message: string) => message.split(/\r?\n/, 1)[0]?.trim() || 'No message';

const isUnknown = (name: string) => name === '' || name === '<unknown>';

export const author = (name: string) => (isUnknown(name) ? 'Unknown author' : name);

export const lockOwner = (name: string) => (isUnknown(name) ? 'Unknown user' : name);

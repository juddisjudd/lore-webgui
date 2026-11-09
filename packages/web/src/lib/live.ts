import { eventsPath } from '@lore-webui/api';

const RECONNECT_MS = 5000;
// The gateway pings every 8 seconds; a proxy can hold a dead stream open without telling the browser.
const SILENCE_MS = 20000;

export interface Watchers {
	readonly onOpen: () => void;
	readonly onEvent: () => void;
}

export function watchRepository(repoId: string, { onOpen, onEvent }: Watchers): () => void {
	let source: EventSource | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const reconnectLater = () => {
		source?.close();
		clearTimeout(timer);
		timer = setTimeout(connect, RECONNECT_MS);
	};

	const alive = () => {
		clearTimeout(timer);
		timer = setTimeout(reconnectLater, SILENCE_MS);
	};

	function connect() {
		source = new EventSource(eventsPath(repoId));
		source.onopen = () => {
			alive();
			onOpen();
		};
		source.onmessage = () => {
			alive();
			onEvent();
		};
		source.addEventListener('ping', alive);
		source.addEventListener('unavailable', () => {
			clearTimeout(timer);
			source?.close();
		});
		source.onerror = () => {
			if (source?.readyState === EventSource.CLOSED) reconnectLater();
		};
	}

	connect();
	return () => {
		clearTimeout(timer);
		source?.close();
	};
}

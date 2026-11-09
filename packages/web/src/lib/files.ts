import { contentPath } from '@lore-webui/api';

export type Preview = 'text' | 'image' | 'audio' | 'video' | 'binary';

const extension = (name: string) => name.slice(name.lastIndexOf('.') + 1).toLowerCase();

const images = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp', 'ico', 'svg']);
const audio = new Set(['wav', 'ogg', 'mp3', 'flac', 'm4a', 'opus']);
const video = new Set(['mp4', 'webm', 'mov', 'm4v']);
const binary = new Set([
	'uasset',
	'umap',
	'fbx',
	'blend',
	'psd',
	'exr',
	'hdr',
	'tga',
	'dds',
	'ktx',
	'zip',
	'7z',
	'gz',
	'exe',
	'dll',
	'so',
	'pdb',
	'bin',
	'pak',
	'wasm'
]);

export function previewFor(name: string): Preview {
	const ext = extension(name);
	if (images.has(ext)) return 'image';
	if (audio.has(ext)) return 'audio';
	if (video.has(ext)) return 'video';
	if (binary.has(ext)) return 'binary';
	return 'text';
}

export const MAX_TEXT_PREVIEW = 1024 * 1024;

export function rawUrl(repo: string, address: string, name: string, download = false): string {
	const query = new URLSearchParams({ name });
	if (download) query.set('download', '1');
	return `${contentPath(repo, address)}?${query}`;
}

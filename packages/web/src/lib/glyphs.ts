import { type AssetKind, assetOf, languageOf, type NodeKind } from '@lore-webui/api';

const bitmap = (rows: Array<string>) =>
	rows.flatMap((row, y) => [...row].flatMap((cell, x) => (cell === '#' ? [`M${x} ${y}h1v1H${x}z`] : []))).join('');

const PACKAGE = bitmap(['#######', '#.....#', '#######', '#.###.#', '#.....#', '#.....#', '#######']);

export const assetGlyphs: Record<AssetKind, string> = {
	textures: bitmap(['###.###', '###.#.#', '###.###', '.......', '###.###', '#.#.###', '###.###']),
	models: bitmap(['..#####', '.#...##', '#####.#', '#...#.#', '#...#.#', '#...##.', '#####..']),
	audio: bitmap(['..#....', '..#.#..', '#.#.#.#', '#.#.#.#', '#.#.#.#', '..#.#..', '..#....']),
	video: bitmap(['.#.....', '.##....', '.###...', '.####..', '.###...', '.##....', '.#.....']),
	fonts: bitmap(['..###..', '.##.##.', '##...##', '#######', '##...##', '##...##', '##...##']),
	unreal: PACKAGE,
	unity: PACKAGE,
	godot: PACKAGE
};

export const glyphs = {
	folder: bitmap(['.......', '###....', '#######', '#.....#', '#.....#', '#.....#', '#######']),
	file: bitmap(['####...', '#..##..', '#...##.', '#....#.', '#....#.', '#....#.', '######.']),
	code: bitmap(['.##.##.', '.#...#.', '.#...#.', '#.....#', '.#...#.', '.#...#.', '.##.##.']),
	link: bitmap(['...####', '.....##', '....#.#', '...#..#', '..#....', '.#.....', '#......']),
	lock: bitmap(['..###..', '.#...#.', '.#...#.', '#######', '###.###', '###.###', '#######']),
	up: bitmap(['...#...', '..###..', '.#.#.#.', '...#...', '...#...', '...#...', '...#...'])
};

export function glyphFor(name: string, kind: NodeKind): string {
	if (kind === 'directory') return glyphs.folder;
	if (kind === 'link') return glyphs.link;
	const lower = name.toLowerCase();
	const asset = assetOf(lower);
	if (asset) return assetGlyphs[asset];
	return languageOf(lower) ? glyphs.code : glyphs.file;
}

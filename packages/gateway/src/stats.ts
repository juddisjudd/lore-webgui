import { type AssetKind, assetOf, HEADER, languageOf, type RepositoryStats } from "@lore-webui/api"

// Build output, engine caches and vendored code would drown out what a team actually authors.
const ignoredDirectories = new Set([
	".git",
	"node_modules",
	"vendor",
	"third_party",
	"thirdparty",
	"external",
	"extern",
	"intermediate",
	"binaries",
	"deriveddatacache",
	"saved",
	"library",
	"temp",
	"obj",
	"target",
	"dist",
	"build"
])

const ignoredSuffixes = [".generated.h", ".gen.cpp", ".min.js", ".min.css", ".d.ts"]

export type Classification =
	| { readonly type: "code"; readonly language: string }
	| { readonly type: "asset"; readonly kind: AssetKind }

export function classify(path: string): Classification | undefined {
	const segments = path.toLowerCase().split("/")
	const name = segments.pop() ?? ""
	if (segments.some((segment) => ignoredDirectories.has(segment))) return undefined
	if (ignoredSuffixes.some((suffix) => name.endsWith(suffix))) return undefined
	const language = languageOf(name)
	if (language) return { type: "code", language }
	const kind = assetOf(name)
	return kind ? { type: "asset", kind } : undefined
}

export interface FileSize {
	readonly path: string
	readonly size: number
}

export function summarize(files: Iterable<FileSize>, signature: string | null): RepositoryStats {
	const code = new Map<string, number>()
	const assets = new Map<AssetKind, { files: number; bytes: number }>()
	let headers = 0
	let codeFiles = 0
	for (const file of files) {
		const found = classify(file.path)
		if (!found) continue
		if (found.type === "asset") {
			const entry = assets.get(found.kind) ?? { files: 0, bytes: 0 }
			entry.files++
			entry.bytes += file.size
			assets.set(found.kind, entry)
			continue
		}
		if (file.size <= 0) continue
		codeFiles++
		if (found.language === HEADER) headers += file.size
		else code.set(found.language, (code.get(found.language) ?? 0) + file.size)
	}
	if (headers > 0) {
		const owner = code.has("C++") ? "C++" : code.has("Objective-C") ? "Objective-C" : "C"
		code.set(owner, (code.get(owner) ?? 0) + headers)
	}
	const total = [...code.values()].reduce((sum, bytes) => sum + bytes, 0)
	return {
		signature,
		code: {
			total,
			files: codeFiles,
			languages: [...code]
				.map(([name, bytes]) => ({ name, bytes, share: total === 0 ? 0 : bytes / total }))
				.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name))
		},
		assets: [...assets]
			.map(([kind, entry]) => ({ kind, ...entry }))
			.sort((a, b) => b.bytes - a.bytes || b.files - a.files)
	}
}

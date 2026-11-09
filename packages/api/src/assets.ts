import type { AssetKind } from "./domain.ts"

const kinds: Record<AssetKind, ReadonlyArray<string>> = {
	textures: ["png", "jpg", "jpeg", "tga", "dds", "exr", "hdr", "psd", "ktx", "ktx2", "basis", "bmp", "tif", "tiff", "webp", "avif", "gif"],
	models: ["fbx", "obj", "gltf", "glb", "blend", "max", "ma", "mb", "usd", "usda", "usdc", "usdz", "abc", "dae", "3ds", "ply", "stl", "vox"],
	audio: ["wav", "ogg", "mp3", "flac", "aif", "aiff", "opus", "bank", "bnk", "wem"],
	video: ["mp4", "mov", "webm", "mkv", "avi", "bik", "bk2"],
	fonts: ["ttf", "otf", "woff", "woff2", "fnt"],
	unreal: ["uasset", "umap"],
	unity: ["unity", "prefab", "asset", "mat", "anim", "controller", "physicmaterial"],
	godot: ["tscn", "tres", "scn", "res"]
}

const byExtension = new Map<string, AssetKind>(
	Object.entries(kinds).flatMap(([kind, extensions]) => extensions.map((ext) => [ext, kind as AssetKind] as const))
)

export function assetOf(name: string): AssetKind | undefined {
	const dot = name.lastIndexOf(".")
	return dot <= 0 ? undefined : byExtension.get(name.slice(dot + 1))
}

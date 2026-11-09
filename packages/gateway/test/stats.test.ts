import { describe, expect, test } from "bun:test"
import { classify, summarize } from "../src/stats.ts"

describe("classify", () => {
	test("maps code by extension and well-known file names", () => {
		expect(classify("src/main.rs")).toEqual({ type: "code", language: "Rust" })
		expect(classify("Source/Game/Player.cpp")).toEqual({ type: "code", language: "C++" })
		expect(classify("Shaders/Lit.usf")).toEqual({ type: "code", language: "HLSL" })
		expect(classify("Content/Island.verse")).toEqual({ type: "code", language: "Verse" })
		expect(classify("CMakeLists.txt")).toEqual({ type: "code", language: "CMake" })
		expect(classify("tools/Dockerfile")).toEqual({ type: "code", language: "Dockerfile" })
	})

	test("maps game assets to their kind", () => {
		expect(classify("Textures/Rock_D.TGA")).toEqual({ type: "asset", kind: "textures" })
		expect(classify("Meshes/crate.fbx")).toEqual({ type: "asset", kind: "models" })
		expect(classify("Audio/Master.bank")).toEqual({ type: "asset", kind: "audio" })
		expect(classify("Movies/intro.bk2")).toEqual({ type: "asset", kind: "video" })
		expect(classify("Content/Maps/Arena.umap")).toEqual({ type: "asset", kind: "unreal" })
		expect(classify("Assets/Player.prefab")).toEqual({ type: "asset", kind: "unity" })
		expect(classify("scenes/main.tscn")).toEqual({ type: "asset", kind: "godot" })
		expect(classify("ui/pixel.ttf")).toEqual({ type: "asset", kind: "fonts" })
	})

	test("ignores data, prose, metadata and dotfiles", () => {
		expect(classify("README.md")).toBeUndefined()
		expect(classify("config/game.toml")).toBeUndefined()
		expect(classify("Assets/Player.prefab.meta")).toBeUndefined()
		expect(classify(".gitignore")).toBeUndefined()
	})

	test("ignores vendored, generated and engine output paths", () => {
		expect(classify("node_modules/pkg/index.js")).toBeUndefined()
		expect(classify("Plugins/Foo/ThirdParty/lib.c")).toBeUndefined()
		expect(classify("Intermediate/Build/Module.cpp")).toBeUndefined()
		expect(classify("DerivedDataCache/Compressed.uasset")).toBeUndefined()
		expect(classify("Source/Player.generated.h")).toBeUndefined()
		expect(classify("web/app.min.js")).toBeUndefined()
	})
})

describe("summarize", () => {
	test("weights languages by bytes and keeps assets apart", () => {
		const stats = summarize(
			[
				{ path: "a.rs", size: 300 },
				{ path: "b.py", size: 100 },
				{ path: "c.rs", size: 100 },
				{ path: "art/a.png", size: 9000 },
				{ path: "art/b.png", size: 1000 },
				{ path: "sfx/hit.wav", size: 4000 }
			],
			"sig"
		)
		expect(stats.code).toEqual({
			total: 500,
			files: 3,
			languages: [
				{ name: "Rust", bytes: 400, share: 0.8 },
				{ name: "Python", bytes: 100, share: 0.2 }
			]
		})
		expect(stats.assets).toEqual([
			{ kind: "textures", files: 2, bytes: 10000 },
			{ kind: "audio", files: 1, bytes: 4000 }
		])
	})

	test("counts headers as C++ when the project has C++ sources", () => {
		const stats = summarize(
			[
				{ path: "a.cpp", size: 100 },
				{ path: "a.h", size: 50 }
			],
			null
		)
		expect(stats.code.languages).toEqual([{ name: "C++", bytes: 150, share: 1 }])
	})

	test("counts headers as C otherwise", () => {
		expect(summarize([{ path: "a.h", size: 10 }], null).code.languages[0]?.name).toBe("C")
	})

	test("counts empty asset files but skips empty source files", () => {
		const stats = summarize(
			[
				{ path: "empty.rs", size: 0 },
				{ path: "placeholder.png", size: 0 }
			],
			null
		)
		expect(stats.code.files).toBe(0)
		expect(stats.assets).toEqual([{ kind: "textures", files: 1, bytes: 0 }])
	})

	test("returns empty stats for an empty tree", () => {
		expect(summarize([], null)).toEqual({ signature: null, code: { total: 0, files: 0, languages: [] }, assets: [] })
	})
})

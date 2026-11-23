import { BunHttpServer } from "@effect/platform-bun"
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Layer } from "effect"
import { HttpRouter } from "effect/http"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from "node:zlib"
import { SPA_INDEX, staticRoutes } from "../src/http/static.ts"

const APP = "/_app/immutable/entry/app.abc123.js"
const APP_SOURCE = `export const answer = ${"42 + ".repeat(200)}0`
const FONT = "/_app/immutable/assets/font.abc123.woff2"

let root: string
let handler: (request: Request) => Promise<Response>
let dispose: () => Promise<void>

beforeAll(() => {
	root = mkdtempSync(join(tmpdir(), "lore-static-"))
	mkdirSync(join(root, "_app/immutable/entry"), { recursive: true })
	mkdirSync(join(root, "_app/immutable/assets"), { recursive: true })
	writeFileSync(join(root, SPA_INDEX), "<!doctype html>")
	writeFileSync(join(root, "robots.txt"), "User-agent: *")
	writeFileSync(join(root, APP.slice(1)), APP_SOURCE)
	writeFileSync(join(root, `${APP.slice(1)}.br`), brotliCompressSync(APP_SOURCE))
	writeFileSync(join(root, `${APP.slice(1)}.gz`), gzipSync(APP_SOURCE))
	writeFileSync(join(root, FONT.slice(1)), "wOF2")
	const web = HttpRouter.toWebHandler(staticRoutes(root).pipe(Layer.provideMerge(BunHttpServer.layerHttpServices)), {
		disableLogger: true
	})
	handler = (request) => web.handler(request)
	dispose = web.dispose
})

afterAll(async () => {
	await dispose()
	rmSync(root, { recursive: true, force: true })
})

const get = (path: string, headers: Record<string, string> = {}) =>
	handler(new Request(`http://localhost${path}`, { headers }))

const bytes = async (response: Response) => Buffer.from(await response.arrayBuffer())

describe("static routes", () => {
	test("hashed build files are cached for a year", async () => {
		for (const path of [APP, FONT]) {
			const response = await get(path)
			expect(response.status).toBe(200)
			expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
		}
	})

	test("a missing hashed file is a 404, not the app shell", async () => {
		const response = await get("/_app/immutable/entry/gone.js", { accept: "text/html" })
		expect(response.status).toBe(404)
	})

	test("the app shell and other files revalidate on every load", async () => {
		for (const path of ["/", "/robots.txt", "/r/abc/files", "/settings"]) {
			const response = await get(path, { accept: "text/html" })
			expect(response.status).toBe(200)
			expect(response.headers.get("cache-control")).toBe("no-cache")
		}
	})
})

describe("compressed build files", () => {
	test("prefer brotli when the browser accepts it", async () => {
		const response = await get(APP, { "accept-encoding": "gzip, deflate, br, zstd" })
		expect(response.headers.get("content-encoding")).toBe("br")
		expect(response.headers.get("content-type")).toStartWith("text/javascript")
		expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable")
		expect(response.headers.get("vary")).toBe("accept-encoding")
		expect(brotliDecompressSync(await bytes(response)).toString()).toBe(APP_SOURCE)
	})

	test("fall back to gzip, and respect q=0", async () => {
		for (const accept of ["gzip", "br;q=0, gzip"]) {
			const response = await get(APP, { "accept-encoding": accept })
			expect(response.headers.get("content-encoding")).toBe("gzip")
			expect(gunzipSync(await bytes(response)).toString()).toBe(APP_SOURCE)
		}
	})

	test("send the plain file when compression is not accepted or a range is asked for", async () => {
		for (const headers of [{}, { "accept-encoding": "identity" }, { "accept-encoding": "br", range: "bytes=0-5" }]) {
			const response = await get(APP, headers)
			expect(response.headers.get("content-encoding")).toBeNull()
			expect(response.headers.get("vary")).toBe("accept-encoding")
			expect(APP_SOURCE).toStartWith(await response.text())
		}
	})

	test("leave files without compressed copies alone", async () => {
		const response = await get(FONT, { "accept-encoding": "br, gzip" })
		expect(response.headers.get("content-encoding")).toBeNull()
		expect(response.headers.get("vary")).toBeNull()
	})
})

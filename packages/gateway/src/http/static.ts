import { Effect, Layer } from "effect"
import {
	HttpPlatform,
	HttpRouter,
	HttpServerRequest,
	HttpServerRespondable,
	HttpServerResponse,
	HttpStaticServer
} from "effect/http"
import { readdirSync } from "node:fs"
import { join } from "node:path"

export const SPA_INDEX = "200.html"

// SvelteKit puts a content hash in every file name here, so a URL under it never changes content.
const IMMUTABLE = "_app/immutable"

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable"

const encodings = [
	{ name: "br", suffix: ".br" },
	{ name: "gzip", suffix: ".gz" }
] as const

const accepts = (header: string | undefined, coding: string) =>
	header?.split(",").some((part) => {
		const [name = "", ...params] = part.split(";").map((piece) => piece.trim())
		return name.toLowerCase() === coding && !params.some((param) => /^q=0(\.0*)?$/i.test(param))
	}) ?? false

const listFiles = (dir: string) => {
	try {
		return new Set(readdirSync(dir, { recursive: true, encoding: "utf8" }).map((file) => file.replaceAll("\\", "/")))
	} catch {
		return new Set<string>()
	}
}

const immutableRoutes = (dir: string) =>
	Layer.effectDiscard(
		Effect.gen(function* () {
			const router = yield* HttpRouter.HttpRouter
			const platform = yield* HttpPlatform.HttpPlatform
			const plain = yield* HttpStaticServer.make({ root: dir, cacheControl: IMMUTABLE_CACHE })
			const files = listFiles(dir)

			const handler = HttpServerRequest.HttpServerRequest.use((request) => {
				const file = (request.url.split("?", 1)[0] ?? "").replace(/^\/+/, "")
				const compressible = encodings.some((encoding) => files.has(file + encoding.suffix))
				const encoding =
					request.headers["range"] === undefined
						? encodings.find(
								(e) => files.has(file + e.suffix) && accepts(request.headers["accept-encoding"], e.name)
							)
						: undefined
				const response = encoding
					? platform
							.fileResponse(join(dir, file + encoding.suffix), {
								contentType: Bun.file(file).type || "application/octet-stream",
								headers: { "cache-control": IMMUTABLE_CACHE, "content-encoding": encoding.name }
							})
							.pipe(Effect.catch(() => plain))
					: plain
				return response.pipe(
					Effect.map((r) => (compressible ? HttpServerResponse.setHeader(r, "vary", "accept-encoding") : r)),
					Effect.catch(HttpServerRespondable.toResponse)
				)
			})

			yield* router.prefixed(`/${IMMUTABLE}`).add("GET", "/*", handler)
		})
	)

export const staticRoutes = (root: string) => {
	const shell = HttpServerResponse.file(join(root, SPA_INDEX), {
		contentType: "text/html; charset=utf-8",
		headers: { "cache-control": "no-cache" }
	})
	return Layer.mergeAll(
		immutableRoutes(join(root, IMMUTABLE)),
		HttpStaticServer.layer({ root, spa: true, index: SPA_INDEX, cacheControl: "no-cache" }),
		HttpRouter.add("GET", "/r/*", shell)
	)
}

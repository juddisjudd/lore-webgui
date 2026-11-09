import type { ApiError } from "@lore-webui/api"
import { Effect, Option, Stream } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { Lore } from "../lore/Lore.ts"

const statuses: Record<ApiError.LoreError["_tag"], number> = {
	NotFound: 404,
	BadRequest: 400,
	Conflict: 409,
	Forbidden: 403,
	NotSupported: 501,
	Unavailable: 503,
	LoreFailure: 502
}

const passthrough = ["content-length", "content-range", "accept-ranges"] as const

// Repository content is untrusted, so it must never run as script on the gateway origin.
const CONTENT_SECURITY_POLICY = "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox"

const contentType = (name: string | null) => {
	const type = name ? Bun.file(name).type : ""
	return type === "" ? "application/octet-stream" : type
}

const disposition = (name: string | null, download: boolean) => {
	const kind = download ? "attachment" : "inline"
	return name ? `${kind}; filename*=UTF-8''${encodeURIComponent(name)}` : kind
}

const serve = (method: "GET" | "HEAD") => (request: HttpServerRequest.HttpServerRequest) =>
	Effect.gen(function* () {
		const lore = yield* Lore
		const params = yield* HttpRouter.params
		const url = Option.getOrUndefined(HttpServerRequest.toURL(request))
		const name = url?.searchParams.get("name") ?? null
		const download = url?.searchParams.get("download") === "1"
		const upstream = yield* lore.content(params.repo ?? "", params.address ?? "", {
			method,
			range: request.headers["range"]
		})
		const headers: Record<string, string> = {
			"content-disposition": disposition(name, download),
			"cache-control": "private, max-age=31536000, immutable",
			"content-security-policy": CONTENT_SECURITY_POLICY,
			"x-content-type-options": "nosniff"
		}
		for (const key of passthrough) {
			const value = upstream.headers.get(key)
			if (value !== null) headers[key] = value
		}
		const options = { status: upstream.status, headers, contentType: contentType(name) }
		const body = upstream.body
		if (method === "HEAD" || body === null) return HttpServerResponse.empty(options)
		const length = Number(upstream.headers.get("content-length"))
		return HttpServerResponse.stream(
			Stream.fromReadableStream({ evaluate: () => body, onError: (cause) => cause }),
			Number.isFinite(length) ? { ...options, contentLength: length } : options
		)
	}).pipe(
		Effect.catch((error: ApiError.LoreError) =>
			Effect.succeed(HttpServerResponse.text(error.message, { status: statuses[error._tag] }))
		)
	)

const path = "/api/repositories/:repo/content/raw/:address"

export const ContentRoutes = HttpRouter.addAll([
	HttpRouter.route("GET", path, serve("GET")),
	HttpRouter.route("HEAD", path, serve("HEAD"))
])

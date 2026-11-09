import { Effect, Stream } from "effect"
import { HttpRouter, HttpServerResponse } from "effect/http"
import { Lore } from "../lore/Lore.ts"

// Bun closes a connection after 10 idle seconds, so the stream must write more often than that.
const HEARTBEAT = "8 seconds"

const RETRY_MS = 5000

const frame = (lines: ReadonlyArray<string>) => `${lines.join("\n")}\n\n`

const unavailable = () => Stream.make(frame(["event: unavailable", "data: {}"]))

const closed = () => Stream.make(frame([": upstream closed"]))

const stream = Effect.gen(function* () {
	const lore = yield* Lore
	const { repo = "" } = yield* HttpRouter.params
	const events = lore.events(repo).pipe(
		Stream.map((event) => frame([`data: ${JSON.stringify(event)}`])),
		Stream.catchTags(
			{ NotSupported: unavailable, Forbidden: unavailable, NotFound: unavailable, BadRequest: unavailable },
			closed
		),
		Stream.merge(
			Stream.tick(HEARTBEAT).pipe(Stream.map(() => frame(["event: ping", "data: {}"]))),
			{ haltStrategy: "left" }
		)
	)
	const body = Stream.concat(Stream.make(frame([`retry: ${RETRY_MS}`])), events).pipe(Stream.encodeText)
	return HttpServerResponse.stream(body, {
		contentType: "text/event-stream",
		headers: { "cache-control": "no-cache", "x-accel-buffering": "no" }
	})
})

export const EventRoutes = HttpRouter.add("GET", "/api/repositories/:repo/events", stream)

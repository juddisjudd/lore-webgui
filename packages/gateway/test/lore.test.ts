import { Code, ConnectError } from "@connectrpc/connect"
import { connectNodeAdapter } from "@connectrpc/connect-node"
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test"
import { Effect, Layer, Option, Redacted } from "effect"
import { createServer, type Http2Server } from "node:http2"
import type { AddressInfo } from "node:net"
import { CurrentUser, OPEN_ACCESS, type Viewer } from "../src/auth/CurrentUser.ts"
import { Settings } from "../src/config.ts"
import { ThinClientService } from "../src/gen/lore/thin_client/v1/thin_client_pb.ts"
import { Lore } from "../src/lore/Lore.ts"

const REPO = "0123456789abcdef0123456789abcdef"
const KNOWN = "aa".repeat(32)
const MISSING = "bb".repeat(32)

let server: Http2Server
let grpcUrl: string
let calls: Array<{ signature: string; authorization: string | null }> = []

beforeAll(async () => {
	const handler = connectNodeAdapter({
		grpc: true,
		routes: (router) =>
			router.service(ThinClientService, {
				revisionInfo: (request, context) => {
					const signature = request.query.case === "signature" ? Buffer.from(request.query.value).toString("hex") : ""
					calls.push({ signature, authorization: context.requestHeader.get("authorization") })
					if (signature !== KNOWN) throw new ConnectError("no such revision", Code.NotFound)
					return { revision: { signature: request.query.value as Uint8Array, commitMessage: "first", timestamp: 1n } }
				}
			})
	})
	server = createServer(handler)
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
	grpcUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
	server.close()
})

beforeEach(() => {
	calls = []
})

const viewer = (username: string): Viewer => ({ user: { ...OPEN_ACCESS.user, username }, session: null })

const run = <A, E>(program: Effect.Effect<A, E, Lore>, overrides: Parameters<typeof Settings.make>[0] = {}) =>
	Effect.runPromise(
		Effect.scoped(program.pipe(Effect.provide(Lore.layer.pipe(Layer.provide(Settings.make({ grpcUrl, ...overrides }))))))
	)

const revision = (signature: string, as: Viewer | null = null) =>
	Lore.use((lore) => lore.revision(REPO, signature)).pipe(Effect.provideService(CurrentUser, as))

describe("revision lookups", () => {
	test("ask Lore once per revision and caller", async () => {
		const result = await run(
			Effect.gen(function* () {
				const first = yield* revision(KNOWN, viewer("ana"))
				const again = yield* revision(KNOWN, viewer("ana"))
				yield* revision(KNOWN, viewer("ben"))
				return { first, again }
			})
		)
		expect(result.first.message).toBe("first")
		expect(result.again).toEqual(result.first)
		expect(calls.map((c) => c.signature)).toEqual([KNOWN, KNOWN])
		expect(calls.map((c) => c.authorization?.startsWith("Bearer "))).toEqual([true, true])
		expect(calls[0]?.authorization).not.toBe(calls[1]?.authorization)
	})

	test("share one answer across users when the gateway has its own token", async () => {
		await run(
			Effect.gen(function* () {
				yield* revision(KNOWN, viewer("ana"))
				yield* revision(KNOWN, viewer("ben"))
			}),
			{ token: Option.some(Redacted.make("service-token")) }
		)
		expect(calls).toEqual([{ signature: KNOWN, authorization: "Bearer service-token" }])
	})

	test("do not remember a missing revision", async () => {
		const tags = await run(
			Effect.gen(function* () {
				const first = yield* Effect.flip(revision(MISSING))
				const second = yield* Effect.flip(revision(MISSING))
				return [first._tag, second._tag]
			})
		)
		expect(tags).toEqual(["NotFound", "NotFound"])
		expect(calls).toHaveLength(2)
	})
})

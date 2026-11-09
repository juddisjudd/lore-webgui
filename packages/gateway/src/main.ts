import { BunHttpServer, BunRuntime } from "@effect/platform-bun"
import { LoreApi } from "@lore-webui/api"
import { Effect, Layer, Option } from "effect"
import { HttpRouter, HttpServerResponse, HttpStaticServer } from "effect/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { Accounts } from "./auth/Accounts.ts"
import { AuthMiddleware } from "./auth/middleware.ts"
import { Settings } from "./config.ts"
import { ContentRoutes } from "./http/content.ts"
import { EventRoutes } from "./http/events.ts"
import { ApiHandlers } from "./http/handlers.ts"
import { Lore } from "./lore/Lore.ts"
import { Stats } from "./lore/Stats.ts"

const SPA_INDEX = "200.html"

const ApiRoutes = HttpApiBuilder.layer(LoreApi, { openapiPath: "/api/openapi.json" }).pipe(Layer.provide(ApiHandlers))

const DocsRoute = HttpApiScalar.layer(LoreApi, { path: "/api/docs" })

const StaticRoutes = Layer.unwrap(
	Effect.gen(function* () {
		const settings = yield* Settings
		const root = Option.getOrElse(settings.staticDir, () => resolve(import.meta.dir, "../../web/build"))
		if (!existsSync(join(root, SPA_INDEX))) {
			yield* Effect.logInfo(`No web build at ${root}; serving the API only`)
			return Layer.empty
		}
		yield* Effect.logInfo(`Serving web UI from ${root}`)
		const shell = HttpServerResponse.file(join(root, SPA_INDEX), { contentType: "text/html; charset=utf-8" })
		return Layer.mergeAll(
			HttpStaticServer.layer({ root, spa: true, index: SPA_INDEX }),
			HttpRouter.add("GET", "/r/*", shell)
		)
	})
)

const Server = Layer.unwrap(
	Effect.gen(function* () {
		const { port, grpcUrl, httpUrl } = yield* Settings
		yield* Effect.logInfo(`Lore gRPC ${grpcUrl}, HTTP ${httpUrl}`)
		yield* Effect.logInfo(`Gateway listening on http://localhost:${port}`)
		return HttpRouter.serve(Layer.mergeAll(ApiRoutes, DocsRoute, ContentRoutes, EventRoutes, StaticRoutes, AuthMiddleware)).pipe(
			Layer.provide(BunHttpServer.layer({ port }))
		)
	})
)

Layer.launch(Server).pipe(
	Effect.provide(Stats.layer),
	Effect.provide(Lore.layer),
	Effect.provide(Accounts.layer),
	Effect.provide(Settings.layer),
	BunRuntime.runMain
)

import { Config, Context, Effect, Layer, Option, Redacted } from "effect"

export interface GatewaySettings {
	readonly grpcUrl: string
	readonly httpUrl: string
	readonly token: Option.Option<Redacted.Redacted<string>>
	readonly port: number
	readonly staticDir: Option.Option<string>
	readonly maxDiffBytes: number
	readonly historyConcurrency: number
}

const settings = Effect.gen(function* () {
	const host = yield* Config.String("LORE_HOST").pipe(Config.withDefault("localhost"))
	const grpcUrl = yield* Config.String("LORE_GRPC_URL").pipe(Config.withDefault(`http://${host}:41337`))
	const httpUrl = yield* Config.String("LORE_HTTP_URL").pipe(Config.withDefault(`http://${host}:41339`))
	return {
		grpcUrl: grpcUrl.replace(/\/+$/, ""),
		httpUrl: httpUrl.replace(/\/+$/, ""),
		token: yield* Config.option(Config.Redacted("LORE_TOKEN")),
		port: yield* Config.Port("PORT").pipe(Config.withDefault(7337)),
		staticDir: yield* Config.option(Config.String("STATIC_DIR")),
		maxDiffBytes: yield* Config.Int("MAX_DIFF_BYTES").pipe(Config.withDefault(2 * 1024 * 1024)),
		historyConcurrency: yield* Config.Int("HISTORY_CONCURRENCY").pipe(Config.withDefault(16))
	} satisfies GatewaySettings
})

export class Settings extends Context.Service<Settings, GatewaySettings>()("lore-webui/gateway/Settings") {
	static readonly layer = Layer.effect(Settings, settings)
	static readonly make = (overrides: Partial<GatewaySettings> = {}) =>
		Layer.succeed(Settings, {
			grpcUrl: "http://localhost:41337",
			httpUrl: "http://localhost:41339",
			token: Option.none(),
			port: 7337,
			staticDir: Option.none(),
			maxDiffBytes: 2 * 1024 * 1024,
			historyConcurrency: 16,
			...overrides
		})
}

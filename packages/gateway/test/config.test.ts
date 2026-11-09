import { describe, expect, test } from "bun:test"
import { ConfigProvider, Effect, Layer, Option, Redacted } from "effect"
import { Settings } from "../src/config.ts"

const load = (env: Record<string, string | undefined>) =>
	Effect.runPromise(
		Effect.gen(function* () {
			return yield* Settings
		}).pipe(Effect.provide(Settings.layer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env))))))
	)

describe("Settings", () => {
	test("derives both Lore URLs from LORE_HOST", async () => {
		const settings = await load({ LORE_HOST: "lore.local" })
		expect(settings.grpcUrl).toBe("http://lore.local:41337")
		expect(settings.httpUrl).toBe("http://lore.local:41339")
		expect(settings.port).toBe(7337)
	})

	test("treats an empty LORE_TOKEN as no token", async () => {
		expect(Option.isNone((await load({ LORE_TOKEN: "" })).token)).toBe(true)
		expect(Option.isNone((await load({ LORE_TOKEN: "   " })).token)).toBe(true)
	})

	test("keeps a real LORE_TOKEN", async () => {
		const { token } = await load({ LORE_TOKEN: "secret" })
		expect(Option.map(token, Redacted.value)).toEqual(Option.some("secret"))
	})
})

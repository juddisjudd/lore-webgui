import { LoreApi } from "@lore-webui/api"
import { Effect, Layer, Option } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Settings } from "../config.ts"
import { textDiff, tooLargeDiff } from "../diff.ts"
import { Lore } from "../lore/Lore.ts"
import { Stats } from "../lore/Stats.ts"

const SystemHandlers = HttpApiBuilder.group(
	LoreApi,
	"system",
	Effect.fn(function* (handlers) {
		const lore = yield* Lore
		const settings = yield* Settings
		const base = {
			grpcUrl: settings.grpcUrl,
			httpUrl: settings.httpUrl,
			authenticated: Option.isSome(settings.token)
		}
		return handlers.handleAll({
			health: () => Effect.void,
			server: () =>
				lore.environment.pipe(
					Effect.match({
						onFailure: (error) => ({ ...base, reachable: false, compression: null, oidcIssuer: null, error: error.message }),
						onSuccess: (env) => ({ ...base, reachable: true, ...env, error: null })
					})
				)
		})
	})
)

const RepositoryHandlers = HttpApiBuilder.group(
	LoreApi,
	"repositories",
	Effect.fn(function* (handlers) {
		const lore = yield* Lore
		const stats = yield* Stats
		return handlers.handleAll({
			list: () => lore.listRepositories,
			create: ({ payload }) => lore.createRepository(payload),
			get: ({ params }) => lore.getRepository(params.repo),
			delete: ({ params }) => lore.deleteRepository(params.repo),
			stats: ({ params, query }) => stats.forBranch(params.repo, query.branch)
		})
	})
)

const BranchHandlers = HttpApiBuilder.group(
	LoreApi,
	"branches",
	Effect.fn(function* (handlers) {
		const lore = yield* Lore
		return handlers.handleAll({
			list: ({ params, query }) => lore.listBranches(params.repo, query.includeDeleted ?? false),
			create: ({ params, payload }) => lore.createBranch(params.repo, payload),
			get: ({ params }) => lore.getBranch(params.repo, params.branch),
			delete: ({ params }) => lore.deleteBranch(params.repo, params.branch),
			history: ({ params, query }) => lore.history(params.repo, params.branch, query.cursor),
			locks: ({ params }) => lore.locks(params.repo, params.branch)
		})
	})
)

const RevisionHandlers = HttpApiBuilder.group(
	LoreApi,
	"revisions",
	Effect.fn(function* (handlers) {
		const lore = yield* Lore
		return handlers.handleAll({
			get: ({ params }) => lore.revision(params.repo, params.signature),
			tree: ({ params, query }) => lore.tree(params.repo, params.signature, query.path),
			changes: ({ params, query }) => lore.changes(params.repo, params.signature, query.against)
		})
	})
)

const ContentHandlers = HttpApiBuilder.group(
	LoreApi,
	"content",
	Effect.fn(function* (handlers) {
		const lore = yield* Lore
		const { maxDiffBytes } = yield* Settings

		const read = Effect.fn("ContentHandlers.read")(function* (repo: string, address: string | undefined) {
			if (!address) return { bytes: new Uint8Array(0), tooLarge: false }
			const response = yield* lore.content(repo, address)
			const length = Number(response.headers.get("content-length") ?? Number.NaN)
			if (length > maxDiffBytes) {
				yield* Effect.promise(() => response.body?.cancel() ?? Promise.resolve())
				return { bytes: new Uint8Array(0), tooLarge: true }
			}
			const bytes = new Uint8Array(yield* Effect.promise(() => response.arrayBuffer()))
			return { bytes, tooLarge: bytes.byteLength > maxDiffBytes }
		})

		return handlers.handle("diff", ({ params, query }) =>
			Effect.all([read(params.repo, query.from), read(params.repo, query.to)], { concurrency: 2 }).pipe(
				Effect.map(([before, after]) =>
					before.tooLarge || after.tooLarge ? tooLargeDiff : textDiff(before.bytes, after.bytes)
				)
			)
		)
	})
)

export const ApiHandlers = Layer.mergeAll(
	SystemHandlers,
	RepositoryHandlers,
	BranchHandlers,
	RevisionHandlers,
	ContentHandlers
)

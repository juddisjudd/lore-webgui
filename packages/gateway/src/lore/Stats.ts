import type { ApiError, RepositoryStats } from "@lore-webui/api"
import { Cache, Context, Duration, Effect, Exit, Layer } from "effect"
import { summarize } from "../stats.ts"
import { Lore } from "./Lore.ts"

export interface StatsService {
	readonly forBranch: (repo: string, branch?: string) => Effect.Effect<RepositoryStats, ApiError.LoreError>
}

const CACHE_CAPACITY = 512

const make = Effect.gen(function* () {
	const lore = yield* Lore

	// Keys name a revision signature, a content hash, so computed stats never go stale.
	const cache = yield* Cache.makeWith(
		(key: string) => {
			const [repo = "", signature = ""] = key.split(":")
			return lore.files(repo, signature).pipe(Effect.map((files) => summarize(files, signature)))
		},
		{
			capacity: CACHE_CAPACITY,
			timeToLive: (exit) => (Exit.isSuccess(exit) ? Duration.infinity : Duration.zero)
		}
	)

	const forBranch = Effect.fn("Stats.forBranch")(function* (repo: string, branch?: string) {
		const branchId = branch ?? (yield* lore.getRepository(repo)).defaultBranchId
		const { latest } = yield* lore.getBranch(repo, branchId)
		if (!latest) return summarize([], null)
		return yield* Cache.get(cache, `${repo.toLowerCase()}:${latest}`)
	})

	return Stats.of({ forBranch })
})

export class Stats extends Context.Service<Stats, StatsService>()("lore-webui/gateway/Stats") {
	static readonly layer = Layer.effect(Stats, make)
}

import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"
import {
	Branch,
	CreateBranch,
	CreateRepository,
	FileDiff,
	HistoryPage,
	Repository,
	RepositoryStats,
	Revision,
	RevisionDiff,
	ServerInfo,
	TreeListing
} from "./domain.ts"
import { LoreErrors } from "./errors.ts"

const repo = { repo: Schema.String }

export class SystemApi extends HttpApiGroup.make("system").add(
	HttpApiEndpoint.get("server", "/server", { success: ServerInfo })
)
	.prefix("/api")
{}

export class RepositoriesApi extends HttpApiGroup.make("repositories")
	.add(
		HttpApiEndpoint.get("list", "/", { success: Schema.Array(Repository), error: LoreErrors }),
		HttpApiEndpoint.post("create", "/", { payload: CreateRepository, success: Repository, error: LoreErrors }),
		HttpApiEndpoint.get("get", "/:repo", { params: repo, success: Repository, error: LoreErrors }),
		HttpApiEndpoint.delete("delete", "/:repo", { params: repo, success: Repository, error: LoreErrors }),
		HttpApiEndpoint.get("stats", "/:repo/stats", {
			params: repo,
			query: { branch: Schema.optional(Schema.String) },
			success: RepositoryStats,
			error: LoreErrors
		})
	)
	.prefix("/api/repositories")
{}

export class BranchesApi extends HttpApiGroup.make("branches")
	.add(
		HttpApiEndpoint.get("list", "/", {
			params: repo,
			query: { includeDeleted: Schema.optional(Schema.Boolean) },
			success: Schema.Array(Branch),
			error: LoreErrors
		}),
		HttpApiEndpoint.post("create", "/", { params: repo, payload: CreateBranch, success: Branch, error: LoreErrors }),
		HttpApiEndpoint.get("get", "/:branch", {
			params: { ...repo, branch: Schema.String },
			success: Branch,
			error: LoreErrors
		}),
		HttpApiEndpoint.delete("delete", "/:branch", {
			params: { ...repo, branch: Schema.String },
			success: Branch,
			error: LoreErrors
		}),
		HttpApiEndpoint.get("history", "/:branch/history", {
			params: { ...repo, branch: Schema.String },
			query: { cursor: Schema.optional(Schema.String) },
			success: HistoryPage,
			error: LoreErrors
		})
	)
	.prefix("/api/repositories/:repo/branches")
{}

export class RevisionsApi extends HttpApiGroup.make("revisions")
	.add(
		HttpApiEndpoint.get("get", "/:signature", {
			params: { ...repo, signature: Schema.String },
			success: Revision,
			error: LoreErrors
		}),
		HttpApiEndpoint.get("tree", "/:signature/tree", {
			params: { ...repo, signature: Schema.String },
			query: { path: Schema.optional(Schema.String) },
			success: TreeListing,
			error: LoreErrors
		}),
		HttpApiEndpoint.get("changes", "/:signature/changes", {
			params: { ...repo, signature: Schema.String },
			query: { against: Schema.optional(Schema.String) },
			success: RevisionDiff,
			error: LoreErrors
		})
	)
	.prefix("/api/repositories/:repo/revisions")
{}

export class ContentApi extends HttpApiGroup.make("content")
	.add(
		HttpApiEndpoint.get("diff", "/diff", {
			params: repo,
			query: { from: Schema.optional(Schema.String), to: Schema.optional(Schema.String) },
			success: FileDiff,
			error: LoreErrors
		})
	)
	.prefix("/api/repositories/:repo/content")
{}

export class LoreApi extends HttpApi.make("lore-webui")
	.add(SystemApi)
	.add(RepositoriesApi)
	.add(BranchesApi)
	.add(RevisionsApi)
	.add(ContentApi)
	.annotateMerge(OpenApi.annotations({ title: "Lore Web UI gateway" }))
{}

export const contentPath = (repoId: string, address: string) =>
	`/api/repositories/${encodeURIComponent(repoId)}/content/raw/${encodeURIComponent(address)}`

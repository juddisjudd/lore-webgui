import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/http-api"
import {
	AuthStatus,
	Branch,
	BranchComparison,
	CreateBranch,
	LoginRequest,
	NewUser,
	PasswordChange,
	PasswordReset,
	SetupRequest,
	User,
	UserUpdate,
	CreateRepository,
	FileDiff,
	FileLock,
	HistoryPage,
	Repository,
	RepositoryStats,
	Revision,
	RevisionDiff,
	ServerInfo,
	TreeListing
} from "./domain.ts"
import { ApiErrors, AuthErrors } from "./errors.ts"

const repo = { repo: Schema.String }

export class SystemApi extends HttpApiGroup.make("system").add(
	HttpApiEndpoint.get("health", "/health", { success: HttpApiSchema.NoContent }),
	HttpApiEndpoint.get("server", "/server", { success: ServerInfo, error: ApiErrors })
)
	.prefix("/api")
{}

export class RepositoriesApi extends HttpApiGroup.make("repositories")
	.add(
		HttpApiEndpoint.get("list", "/", { success: Schema.Array(Repository), error: ApiErrors }),
		HttpApiEndpoint.post("create", "/", { payload: CreateRepository, success: Repository, error: ApiErrors }),
		HttpApiEndpoint.get("get", "/:repo", { params: repo, success: Repository, error: ApiErrors }),
		HttpApiEndpoint.delete("delete", "/:repo", { params: repo, success: Repository, error: ApiErrors }),
		HttpApiEndpoint.get("stats", "/:repo/stats", {
			params: repo,
			query: { branch: Schema.optional(Schema.String) },
			success: RepositoryStats,
			error: ApiErrors
		}),
		HttpApiEndpoint.get("compare", "/:repo/compare", {
			params: repo,
			query: { base: Schema.String, head: Schema.String },
			success: BranchComparison,
			error: ApiErrors
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
			error: ApiErrors
		}),
		HttpApiEndpoint.post("create", "/", { params: repo, payload: CreateBranch, success: Branch, error: ApiErrors }),
		HttpApiEndpoint.get("get", "/:branch", {
			params: { ...repo, branch: Schema.String },
			success: Branch,
			error: ApiErrors
		}),
		HttpApiEndpoint.delete("delete", "/:branch", {
			params: { ...repo, branch: Schema.String },
			success: Branch,
			error: ApiErrors
		}),
		HttpApiEndpoint.get("history", "/:branch/history", {
			params: { ...repo, branch: Schema.String },
			query: { cursor: Schema.optional(Schema.String) },
			success: HistoryPage,
			error: ApiErrors
		}),
		HttpApiEndpoint.get("locks", "/:branch/locks", {
			params: { ...repo, branch: Schema.String },
			success: Schema.Array(FileLock),
			error: ApiErrors
		})
	)
	.prefix("/api/repositories/:repo/branches")
{}

export class RevisionsApi extends HttpApiGroup.make("revisions")
	.add(
		HttpApiEndpoint.get("get", "/:signature", {
			params: { ...repo, signature: Schema.String },
			success: Revision,
			error: ApiErrors
		}),
		HttpApiEndpoint.get("tree", "/:signature/tree", {
			params: { ...repo, signature: Schema.String },
			query: { path: Schema.optional(Schema.String) },
			success: TreeListing,
			error: ApiErrors
		}),
		HttpApiEndpoint.get("changes", "/:signature/changes", {
			params: { ...repo, signature: Schema.String },
			query: { against: Schema.optional(Schema.String) },
			success: RevisionDiff,
			error: ApiErrors
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
			error: ApiErrors
		})
	)
	.prefix("/api/repositories/:repo/content")
{}

export class AuthApi extends HttpApiGroup.make("auth")
	.add(
		HttpApiEndpoint.get("status", "/status", { success: AuthStatus }),
		HttpApiEndpoint.post("setup", "/setup", { payload: SetupRequest, success: User, error: AuthErrors }),
		HttpApiEndpoint.post("login", "/login", { payload: LoginRequest, success: User, error: AuthErrors }),
		HttpApiEndpoint.post("logout", "/logout", { success: HttpApiSchema.NoContent }),
		HttpApiEndpoint.post("password", "/password", {
			payload: PasswordChange,
			success: HttpApiSchema.NoContent,
			error: AuthErrors
		})
	)
	.prefix("/api/auth")
{}

const userId = { id: Schema.FiniteFromString }

export class UsersApi extends HttpApiGroup.make("users")
	.add(
		HttpApiEndpoint.get("list", "/", { success: Schema.Array(User), error: AuthErrors }),
		HttpApiEndpoint.post("create", "/", { payload: NewUser, success: User, error: AuthErrors }),
		HttpApiEndpoint.patch("update", "/:id", { params: userId, payload: UserUpdate, success: User, error: AuthErrors }),
		HttpApiEndpoint.post("resetPassword", "/:id/password", {
			params: userId,
			payload: PasswordReset,
			success: HttpApiSchema.NoContent,
			error: AuthErrors
		}),
		HttpApiEndpoint.delete("remove", "/:id", { params: userId, success: HttpApiSchema.NoContent, error: AuthErrors })
	)
	.prefix("/api/users")
{}

export class LoreApi extends HttpApi.make("lore-webui")
	.add(AuthApi)
	.add(UsersApi)
	.add(SystemApi)
	.add(RepositoriesApi)
	.add(BranchesApi)
	.add(RevisionsApi)
	.add(ContentApi)
	.annotateMerge(OpenApi.annotations({ title: "Lore Web UI gateway" }))
{}

export const eventsPath = (repoId: string) => `/api/repositories/${encodeURIComponent(repoId)}/events`

export const contentPath = (repoId: string, address: string) =>
	`/api/repositories/${encodeURIComponent(repoId)}/content/raw/${encodeURIComponent(address)}`

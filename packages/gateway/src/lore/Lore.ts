import { createClient, encodeBinaryHeader, type Interceptor } from "@connectrpc/connect"
import { createGrpcTransport } from "@connectrpc/connect-node"
import { ApiError, type CreateBranch, type CreateRepository } from "@lore-webui/api"
import type * as Domain from "@lore-webui/api"
import { Cache, Context, Duration, Effect, Exit, Layer, Option, Redacted, Stream } from "effect"
import { CurrentUser } from "../auth/CurrentUser.ts"
import { Settings } from "../config.ts"
import { AdminService } from "../gen/admin_pb.ts"
import { LockService } from "../gen/lock_pb.ts"
import { NotificationService } from "../gen/lore_notification_pb.ts"
import { CompressionMode, EnvironmentService } from "../gen/lore/environment/v1/environment_pb.ts"
import { RepositoryService } from "../gen/lore/repository/v1/repository_pb.ts"
import { RevisionService } from "../gen/lore/revision/v1/revision_pb.ts"
import { NodeType } from "../gen/lore/thin_client/v1/model_pb.ts"
import { ThinClientService } from "../gen/lore/thin_client/v1/thin_client_pb.ts"
import * as convert from "./convert.ts"
import { badRequest, fromConnect } from "./errors.ts"
import { identity, unsignedIdentityToken } from "./identity.ts"

type LoreError = ApiError.LoreError

export interface EnvironmentInfo {
	readonly compression: string | null
	readonly oidcIssuer: string | null
}

export interface ContentRequest {
	readonly method?: "GET" | "HEAD"
	readonly range?: string | undefined
}

export interface LoreService {
	readonly environment: Effect.Effect<EnvironmentInfo, LoreError>
	readonly serverVersion: Effect.Effect<string | null, LoreError>
	readonly listRepositories: Effect.Effect<ReadonlyArray<Domain.Repository>, LoreError>
	readonly getRepository: (idOrName: string) => Effect.Effect<Domain.Repository, LoreError>
	readonly createRepository: (input: CreateRepository) => Effect.Effect<Domain.Repository, LoreError>
	readonly deleteRepository: (repo: string) => Effect.Effect<Domain.Repository, LoreError>
	readonly listBranches: (
		repo: string,
		includeDeleted: boolean
	) => Effect.Effect<ReadonlyArray<Domain.Branch>, LoreError>
	readonly getBranch: (repo: string, idOrName: string) => Effect.Effect<Domain.Branch, LoreError>
	readonly createBranch: (repo: string, input: CreateBranch) => Effect.Effect<Domain.Branch, LoreError>
	readonly deleteBranch: (repo: string, branch: string) => Effect.Effect<Domain.Branch, LoreError>
	readonly history: (repo: string, branch: string, cursor?: string) => Effect.Effect<Domain.HistoryPage, LoreError>
	readonly locks: (repo: string, branch: string) => Effect.Effect<ReadonlyArray<Domain.FileLock>, LoreError>
	readonly events: (repo: string) => Stream.Stream<Domain.RepositoryEvent, LoreError>
	readonly revision: (repo: string, signature: string) => Effect.Effect<Domain.Revision, LoreError>
	readonly tree: (repo: string, signature: string, path?: string) => Effect.Effect<Domain.TreeListing, LoreError>
	readonly files: (
		repo: string,
		signature: string
	) => Effect.Effect<ReadonlyArray<{ readonly path: string; readonly size: number }>, LoreError>
	readonly changes: (repo: string, signature: string, against?: string) => Effect.Effect<Domain.RevisionDiff, LoreError>
	readonly compare: (repo: string, base: string, head: string) => Effect.Effect<Domain.BranchComparison, LoreError>
	readonly content: (repo: string, address: string, request?: ContentRequest) => Effect.Effect<Response, LoreError>
}

const compressionNames: Record<CompressionMode, string | null> = {
	[CompressionMode.NOT_SPECIFIED]: null,
	[CompressionMode.NO_COMPRESSION]: "none",
	[CompressionMode.LZ4]: "lz4",
	[CompressionMode.OODLE]: "oodle",
	[CompressionMode.ZSTD]: "zstd"
}

const bytes = (value: string, label: string, length?: number) => {
	const decoded = convert.fromHex(value)
	return decoded && (length === undefined || decoded.length === length)
		? Effect.succeed(decoded)
		: Effect.fail(badRequest(`Invalid ${label}: ${value}`))
}

const id = (value: string, label: string) => bytes(value, label, 16)

const signature = (value: string) => bytes(value, "revision signature")

const uuidv7 = () => new Uint8Array(Bun.randomUUIDv7("buffer"))

const normalizePath = (path: string | undefined) => (path ?? "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")

const isDirectChild = (parent: string, path: string) =>
	parent === "" ? !path.includes("/") : path.startsWith(`${parent}/`) && !path.slice(parent.length + 1).includes("/")

const statusError = (status: number, what: string): LoreError => {
	if (status === 404) return new ApiError.NotFound({ message: `${what} not found` })
	if (status === 400) return new ApiError.BadRequest({ message: `Lore rejected the request for ${what}` })
	if (status === 401 || status === 403) return new ApiError.Forbidden({ message: `Not allowed to read ${what}` })
	return new ApiError.LoreFailure({ message: `Lore HTTP ${status} reading ${what}`, code: String(status) })
}

const make = Effect.gen(function* () {
	const settings = yield* Settings
	const token = Option.map(settings.token, Redacted.value)
	const authorization = Option.map(token, (t) => `Bearer ${t}`)

	const auth: Interceptor = (next) => (req) => {
		const name = identity.getStore()
		if (Option.isSome(authorization)) req.header.set("authorization", authorization.value)
		else if (name) req.header.set("authorization", `Bearer ${unsignedIdentityToken(name)}`)
		return next(req)
	}
	const transport = createGrpcTransport({ baseUrl: settings.grpcUrl, interceptors: [auth] })
	const repositories = createClient(RepositoryService, transport)
	const revisions = createClient(RevisionService, transport)
	const thin = createClient(ThinClientService, transport)
	const environments = createClient(EnvironmentService, transport)
	const lockService = createClient(LockService, transport)
	const notifications = createClient(NotificationService, transport)
	const admin = createClient(AdminService, transport)

	const call = <A>(f: (signal: AbortSignal) => Promise<A>) =>
		Effect.flatMap(Effect.service(CurrentUser), (viewer) => {
			const name = viewer?.user.username
			return Effect.tryPromise({
				try: (signal) => (name ? identity.run(name, () => f(signal)) : f(signal)),
				catch: fromConnect
			})
		})

	const collect = <A>(f: (signal: AbortSignal) => AsyncIterable<A>) =>
		call(async (signal) => {
			const out: Array<A> = []
			for await (const item of f(signal)) out.push(item)
			return out
		})

	const scope = (repo: Uint8Array, signal: AbortSignal) => ({
		signal,
		headers: { "lore-partition-bin": encodeBinaryHeader(repo) }
	})

	const environment = call((signal) => environments.environmentGet({}, { signal })).pipe(
		Effect.map(({ environment: env }) => ({
			compression: env?.config?.compressionMode === undefined ? null : compressionNames[env.config.compressionMode],
			oidcIssuer: env?.oidc?.issuer || null
		}))
	)

	const versionCache = yield* Cache.makeWith(
		(_: "version") =>
			call((signal) => admin.serverInfo({}, { signal })).pipe(
				Effect.map(({ version }) => version || null),
				Effect.catchTag("NotSupported", () => Effect.succeed(null))
			),
		{ capacity: 1, timeToLive: (exit) => (Exit.isSuccess(exit) ? Duration.minutes(5) : Duration.zero) }
	)

	const serverVersion = Cache.get(versionCache, "version")

	const listRepositories = collect((signal) => repositories.repositoryList({}, { signal })).pipe(
		Effect.map((items) =>
			items
				.flatMap((r) => (r.repository ? [convert.repository(r.repository)] : []))
				.sort((a, b) => a.name.localeCompare(b.name))
		)
	)

	const getRepository = Effect.fn("Lore.getRepository")(function* (idOrName: string) {
		const query = convert.isId(idOrName)
			? { case: "id" as const, value: yield* id(idOrName, "repository id") }
			: { case: "name" as const, value: idOrName }
		const { repository } = yield* call((signal) => repositories.repositoryGet({ query }, { signal }))
		if (!repository) return yield* new ApiError.NotFound({ message: `Repository ${idOrName} not found` })
		return convert.repository(repository)
	})

	const createRepository = Effect.fn("Lore.createRepository")(function* (input: CreateRepository) {
		const name = input.name.trim()
		const defaultBranchName = input.defaultBranchName.trim() || "main"
		if (name === "") return yield* badRequest("Repository name is required")
		const { repository } = yield* call((signal) =>
			repositories.repositoryCreate(
				{ id: uuidv7(), name, description: input.description, defaultBranchId: uuidv7(), defaultBranchName },
				{ signal }
			)
		)
		if (!repository) return yield* new ApiError.LoreFailure({ message: "Create returned no repository", code: "EMPTY" })
		return convert.repository(repository)
	})

	const deleteRepository = Effect.fn("Lore.deleteRepository")(function* (repo: string) {
		const repoId = yield* id(repo, "repository id")
		const { repository } = yield* call((signal) => repositories.repositoryDelete({ id: repoId }, { signal }))
		if (!repository) return yield* new ApiError.NotFound({ message: `Repository ${repo} not found` })
		return convert.repository(repository)
	})

	const listBranches = Effect.fn("Lore.listBranches")(function* (repo: string, includeDeleted: boolean) {
		const repoId = yield* id(repo, "repository id")
		const items = yield* collect((signal) => revisions.branchList({ includeDeleted }, scope(repoId, signal)))
		return items
			.flatMap((b) => (b.branch ? [convert.branch(b.branch)] : []))
			.sort((a, b) => Number(a.deleted) - Number(b.deleted) || a.name.localeCompare(b.name))
	})

	const getBranch = Effect.fn("Lore.getBranch")(function* (repo: string, idOrName: string) {
		const repoId = yield* id(repo, "repository id")
		const query = convert.isId(idOrName)
			? { case: "id" as const, value: yield* id(idOrName, "branch id") }
			: { case: "name" as const, value: idOrName }
		const { branch } = yield* call((signal) => revisions.branchGet({ query }, scope(repoId, signal)))
		if (!branch) return yield* new ApiError.NotFound({ message: `Branch ${idOrName} not found` })
		return convert.branch(branch)
	})

	const revisionInfo = (repoId: Uint8Array, sig: Uint8Array) =>
		call((signal) => thin.revisionInfo({ query: { case: "signature", value: sig } }, scope(repoId, signal))).pipe(
			Effect.flatMap(({ revision }) =>
				revision
					? Effect.succeed(convert.revision(revision))
					: Effect.fail(new ApiError.NotFound({ message: `Revision ${convert.toHex(sig)} not found` }))
			)
		)

	const revision = Effect.fn("Lore.revision")(function* (repo: string, sig: string) {
		return yield* revisionInfo(yield* id(repo, "repository id"), yield* signature(sig))
	})

	const createBranch = Effect.fn("Lore.createBranch")(function* (repo: string, input: CreateBranch) {
		const repoId = yield* id(repo, "repository id")
		const name = input.name.trim()
		if (name === "") return yield* badRequest("Branch name is required")
		const source = yield* getBranch(repo, input.fromBranchId)
		const from = input.fromSignature ?? source.latest
		if (!from) return yield* badRequest(`Branch ${source.name} has no revisions to branch from`)
		const at = yield* revisionInfo(repoId, yield* signature(from))
		const owner = at.branchId === source.id || at.branchId === "" ? source : yield* getBranch(repo, at.branchId)
		const stack = [{ branchId: owner.id, signature: at.signature }, ...owner.stack].map((p) => ({
			branchId: convert.fromHex(p.branchId)!,
			revisionSignature: convert.fromHex(p.signature)!
		}))
		const { branch } = yield* call((signal) =>
			revisions.branchCreate({ id: uuidv7(), name, category: input.category ?? "", stack }, scope(repoId, signal))
		)
		if (!branch) return yield* new ApiError.LoreFailure({ message: "Create returned no branch", code: "EMPTY" })
		return convert.branch(branch)
	})

	const deleteBranch = Effect.fn("Lore.deleteBranch")(function* (repo: string, branchId: string) {
		const repoId = yield* id(repo, "repository id")
		const target = yield* id(branchId, "branch id")
		const { branch } = yield* call((signal) => revisions.branchDelete({ id: target }, scope(repoId, signal)))
		if (!branch) return yield* new ApiError.NotFound({ message: `Branch ${branchId} not found` })
		return convert.branch(branch)
	})

	const history = Effect.fn("Lore.history")(function* (repo: string, branchId: string, cursor?: string) {
		const repoId = yield* id(repo, "repository id")
		const start = cursor
			? { case: "signature" as const, value: yield* signature(cursor) }
			: { case: "identifier" as const, value: { branchId: yield* id(branchId, "branch id"), number: 0n } }
		const page = yield* call((signal) => revisions.revisionList({ start }, scope(repoId, signal)))
		const items = yield* Effect.forEach(page.items, (item) => revisionInfo(repoId, item.signature), {
			concurrency: settings.historyConcurrency
		})
		return {
			items,
			older: page.signatureBackward ? convert.toHex(page.signatureBackward) : null,
			newer: page.signatureForward ? convert.toHex(page.signatureForward) : null
		}
	})

	const locks = Effect.fn("Lore.locks")(function* (repo: string, branch: string) {
		const repoId = yield* id(repo, "repository id")
		const branchId = convert.isId(branch)
			? yield* id(branch, "branch id")
			: convert.fromHex((yield* getBranch(repo, branch)).id)!
		const { result } = yield* call((signal) => lockService.query({ branch: branchId }, scope(repoId, signal)))
		return result
			.flatMap((lock) => convert.fileLock(lock) ?? [])
			.sort((a, b) => a.path.localeCompare(b.path))
	})

	const events = (repo: string) =>
		Stream.unwrap(
			Effect.gen(function* () {
				const repoId = yield* id(repo, "repository id")
				const controller = yield* Effect.acquireRelease(
					Effect.sync(() => new AbortController()),
					(c) => Effect.sync(() => c.abort())
				)
				const subscription = notifications.subscribe({ repository: repoId }, scope(repoId, controller.signal))
				return Stream.fromAsyncIterable(subscription, fromConnect).pipe(
					Stream.map(convert.repositoryEvent),
					Stream.filter((event): event is Domain.RepositoryEvent => event !== null)
				)
			})
		)

	const listDirectory = (repoId: Uint8Array, sig: Uint8Array, path: string) =>
		collect((signal) =>
			thin.revisionTree(
				{ query: { case: "signature", value: sig }, maxDepth: 1, ...(path ? { pathPrefix: path } : {}) },
				scope(repoId, signal)
			)
		).pipe(
			Effect.map((responses) => {
				let ref: Domain.RevisionRef | null = null
				const children: Array<Domain.TreeEntry> = []
				for (const { payload } of responses) {
					if (payload.case === "header") ref = convert.revisionRef(payload.value.signature, payload.value.identifier)
					else if (payload.case === "node" && isDirectChild(path, payload.value.path)) {
						children.push(convert.treeEntry(payload.value))
					}
				}
				return { ref, children: children.sort(convert.compareEntries) }
			})
		)

	const tree = Effect.fn("Lore.tree")(function* (repo: string, sig: string, rawPath?: string) {
		const repoId = yield* id(repo, "repository id")
		const sigBytes = yield* signature(sig)
		const path = normalizePath(rawPath)
		const fallbackRef = { signature: sig, branchId: "", number: 0 }
		if (path === "") {
			const root = yield* listDirectory(repoId, sigBytes, "")
			return { revision: root.ref ?? fallbackRef, entry: null, children: root.children }
		}
		const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : ""
		const [parent, own] = yield* Effect.all(
			[
				listDirectory(repoId, sigBytes, parentPath),
				listDirectory(repoId, sigBytes, path).pipe(
					Effect.catchTag("BadRequest", () => Effect.succeed({ ref: null, children: [] }))
				)
			],
			{ concurrency: 2 }
		)
		const entry = parent.children.find((child) => child.path === path)
		if (!entry) return yield* new ApiError.NotFound({ message: `No entry at ${path}` })
		return {
			revision: parent.ref ?? fallbackRef,
			entry,
			children: entry.kind === "directory" ? own.children : []
		}
	})

	const files = Effect.fn("Lore.files")(function* (repo: string, sig: string) {
		const repoId = yield* id(repo, "repository id")
		const query = { case: "signature" as const, value: yield* signature(sig) }
		return yield* call(async (signal) => {
			const out: Array<{ path: string; size: number }> = []
			for await (const { payload } of thin.revisionTree({ query }, scope(repoId, signal))) {
				if (payload.case === "node" && payload.value.nodeType === NodeType.FILE) {
					out.push({ path: payload.value.path, size: Number(payload.value.size) })
				}
			}
			return out
		})
	})

	const changes = Effect.fn("Lore.changes")(function* (repo: string, sig: string, against?: string) {
		const repoId = yield* id(repo, "repository id")
		const to = yield* signature(sig)
		const parent = against ?? (yield* revisionInfo(repoId, to)).parent?.signature
		const from = parent ? yield* signature(parent) : convert.ZERO_SIGNATURE
		const responses = yield* collect((signal) =>
			thin.revisionDiff(
				{
					queryFrom: { case: "signatureFrom", value: from },
					queryTo: { case: "signatureTo", value: to },
					autoresolve: true
				},
				scope(repoId, signal)
			)
		)
		const result: {
			from: Domain.RevisionRef | null
			to: Domain.RevisionRef
			base: Domain.RevisionRef | null
			changes: Array<Domain.Change>
			conflicts: Array<Domain.Conflict>
		} = { from: null, to: { signature: sig, branchId: "", number: 0 }, base: null, changes: [], conflicts: [] }
		for (const { payload } of responses) {
			switch (payload.case) {
				case "header": {
					const h = payload.value
					result.from = convert.isZero(h.signatureFrom) ? null : convert.revisionRef(h.signatureFrom, h.identifierFrom)
					result.to = convert.revisionRef(h.signatureTo, h.identifierTo)
					result.base = h.signatureBase ? convert.revisionRef(h.signatureBase, h.identifierBase) : null
					break
				}
				case "change":
					result.changes.push(convert.change(payload.value))
					break
				case "conflict":
					if (payload.value.changeFrom && payload.value.changeTo) {
						result.conflicts.push({
							ours: convert.change(payload.value.changeFrom),
							theirs: convert.change(payload.value.changeTo)
						})
					}
					break
			}
		}
		result.changes.sort((a, b) => a.path.localeCompare(b.path))
		return result
	})

	const compare = Effect.fn("Lore.compare")(function* (repo: string, baseName: string, headName: string) {
		const repoId = yield* id(repo, "repository id")
		const [base, head] = yield* Effect.all([getBranch(repo, baseName), getBranch(repo, headName)], { concurrency: 2 })
		const result = (
			status: Domain.CompareStatus,
			fields: Partial<Omit<Domain.BranchComparison, "base" | "head" | "status">> = {}
		): Domain.BranchComparison => ({
			base,
			head,
			status,
			mergeBase: null,
			ahead: null,
			behind: null,
			revisions: [],
			changes: [],
			conflicts: [],
			...fields
		})
		if (!base.latest || !head.latest) return result("empty")
		if (base.latest === head.latest) return result("identical", { ahead: 0, behind: 0 })
		const baseLatest = base.latest
		const headLatest = head.latest
		const [baseTip, headTip] = yield* Effect.all(
			[revisionInfo(repoId, yield* signature(baseLatest)), revisionInfo(repoId, yield* signature(headLatest))],
			{ concurrency: 2 }
		)

		const isAncestor = (older: Domain.Revision, newer: Domain.Revision, newerBranch: Domain.Branch) =>
			Effect.gen(function* () {
				if (older.branchId === newer.branchId) return older.number <= newer.number
				const point = newerBranch.stack.find((p) => p.branchId === older.branchId)
				if (!point) return false
				const fork = yield* revisionInfo(repoId, yield* signature(point.signature))
				return older.number <= fork.number
			})

		const toRef = (r: Domain.Revision): Domain.RevisionRef => ({
			signature: r.signature,
			branchId: r.branchId,
			number: r.number
		})

		const headRevisionsSince = (mergeBase: Domain.RevisionRef) =>
			history(repo, head.id).pipe(Effect.map((page) => page.items.filter((r) => r.number > mergeBase.number)))

		if (yield* isAncestor(baseTip, headTip, head)) {
			const [diff, revisions] = yield* Effect.all(
				[changes(repo, headLatest, baseLatest), headRevisionsSince(toRef(baseTip))],
				{ concurrency: 2 }
			)
			return result("ahead", {
				mergeBase: toRef(baseTip),
				ahead: headTip.number - baseTip.number,
				behind: 0,
				revisions,
				changes: diff.changes
			})
		}
		if (yield* isAncestor(headTip, baseTip, base)) {
			return result("behind", { mergeBase: toRef(headTip), ahead: 0, behind: baseTip.number - headTip.number })
		}
		const merge = yield* changes(repo, baseLatest, headLatest)
		if (!merge.base) {
			const forward = yield* changes(repo, headLatest, baseLatest)
			return result("unrelated", { changes: forward.changes })
		}
		const mergeBase = merge.base
		return result("diverged", {
			mergeBase,
			ahead: headTip.number - mergeBase.number,
			behind: baseTip.number - mergeBase.number,
			revisions: yield* headRevisionsSince(mergeBase),
			changes: merge.changes,
			conflicts: merge.conflicts
		})
	})

	const content = Effect.fn("Lore.content")(function* (repo: string, address: string, request: ContentRequest = {}) {
		yield* id(repo, "repository id")
		if (!convert.parseAddress(address)) return yield* badRequest(`Invalid content address: ${address}`)
		const headers = new Headers()
		if (Option.isSome(authorization)) headers.set("authorization", authorization.value)
		if (request.range) headers.set("range", request.range)
		const url = `${settings.httpUrl}/v1/repository/${repo.toLowerCase()}/content/${address.toLowerCase()}`
		const response = yield* Effect.tryPromise({
			try: (signal) => fetch(url, { method: request.method ?? "GET", headers, signal }),
			catch: (error) => new ApiError.Unavailable({ message: `Lore HTTP endpoint unreachable: ${String(error)}` })
		})
		if (!response.ok && response.status !== 416) {
			yield* Effect.promise(() => response.body?.cancel() ?? Promise.resolve())
			return yield* Effect.fail(statusError(response.status, `content ${address}`))
		}
		return response
	})

	return Lore.of({
		environment,
		serverVersion,
		listRepositories,
		getRepository,
		createRepository,
		deleteRepository,
		listBranches,
		getBranch,
		createBranch,
		deleteBranch,
		history,
		locks,
		events,
		revision,
		tree,
		files,
		changes,
		compare,
		content
	})
})

export class Lore extends Context.Service<Lore, LoreService>()("lore-webui/gateway/Lore") {
	static readonly layer = Layer.effect(Lore, make)
}

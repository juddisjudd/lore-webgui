import { Database } from "bun:sqlite"
import { ApiError, type NewUser, type Role, type User, type UserUpdate } from "@lore-webui/api"
import { Context, Effect, Layer } from "effect"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { Settings } from "../config.ts"

const SESSION_MS = 30 * 24 * 60 * 60 * 1000
export const MIN_PASSWORD = 12
const MAX_PASSWORD = 256
const USERNAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const MAX_FAILURES = 10
const FAILURE_WINDOW_MS = 15 * 60 * 1000

const SCHEMA = `
create table if not exists users (
	id integer primary key,
	username text not null unique collate nocase,
	password_hash text not null,
	role text not null check (role in ('admin', 'member', 'viewer')),
	must_change_password integer not null default 0,
	disabled integer not null default 0,
	created_at integer not null
);
create table if not exists sessions (
	token_hash text primary key,
	user_id integer not null references users(id) on delete cascade,
	created_at integer not null,
	expires_at integer not null
);
create index if not exists sessions_user on sessions(user_id);
`

interface Row {
	readonly id: number
	readonly username: string
	readonly password_hash: string
	readonly role: Role
	readonly must_change_password: number
	readonly disabled: number
	readonly created_at: number
}

const toUser = (row: Row): User => ({
	id: row.id,
	username: row.username,
	role: row.role,
	mustChangePassword: row.must_change_password === 1,
	disabled: row.disabled === 1,
	created: row.created_at
})

const digest = (value: string) => createHash("sha256").update(value).digest()

const tokenHash = (token: string) => digest(token).toString("hex")

const sameSecret = (a: string, b: string) => timingSafeEqual(digest(a), digest(b))

export const newSecret = () => randomBytes(24).toString("base64url")

export interface AccountsService {
	readonly setupRequired: Effect.Effect<boolean>
	readonly setup: (code: string, username: string, password: string) => Effect.Effect<User, ApiError.AuthError>
	readonly login: (username: string, password: string) => Effect.Effect<User, ApiError.AuthError>
	readonly createSession: (userId: number) => Effect.Effect<string>
	readonly sessionUser: (token: string) => Effect.Effect<User | null>
	readonly endSession: (token: string) => Effect.Effect<void>
	readonly changePassword: (
		userId: number,
		current: string,
		next: string,
		keepSession: string | null
	) => Effect.Effect<void, ApiError.AuthError>
	readonly list: Effect.Effect<ReadonlyArray<User>>
	readonly create: (input: NewUser) => Effect.Effect<User, ApiError.AuthError>
	readonly update: (actor: User, id: number, update: UserUpdate) => Effect.Effect<User, ApiError.AuthError>
	readonly resetPassword: (id: number, password: string) => Effect.Effect<void, ApiError.AuthError>
	readonly remove: (actor: User, id: number) => Effect.Effect<void, ApiError.AuthError>
}

const checkUsername = (username: string) =>
	USERNAME.test(username)
		? Effect.succeed(username)
		: Effect.fail(
				new ApiError.BadRequest({
					message: "Use 1 to 64 letters, digits, dots, dashes or underscores, starting with a letter or digit."
				})
			)

const checkPassword = (password: string) =>
	password.length >= MIN_PASSWORD && password.length <= MAX_PASSWORD
		? Effect.succeed(password)
		: Effect.fail(new ApiError.BadRequest({ message: `Use a password of at least ${MIN_PASSWORD} characters.` }))

const hash = (password: string) => Effect.promise(() => Bun.password.hash(password))

const verify = (password: string, hashed: string) => Effect.promise(() => Bun.password.verify(password, hashed))

export interface AccountsOptions {
	readonly announceSetup?: boolean
	readonly setupCode?: () => string
}

export const makeAccounts = (path: string, { announceSetup = true, setupCode: makeCode = newSecret }: AccountsOptions = {}) =>
	Effect.gen(function* () {
		const db = new Database(path, { create: true, strict: true })
		yield* Effect.addFinalizer(() => Effect.sync(() => db.close()))
		db.exec("pragma journal_mode = wal; pragma foreign_keys = on;")
		db.exec(SCHEMA)

		const byName = db.query<Row, [string]>("select * from users where username = ?")
		const byId = db.query<Row, [number]>("select * from users where id = ?")
		const all = db.query<Row, []>("select * from users order by username collate nocase")
		const count = db.query<{ n: number }, []>("select count(*) as n from users")
		const activeAdmins = db.query<{ n: number }, [number]>(
			"select count(*) as n from users where role = 'admin' and disabled = 0 and id != ?"
		)
		const insertUser = db.query<Row, [string, string, Role, number, number]>(
			"insert into users (username, password_hash, role, must_change_password, created_at) values (?, ?, ?, ?, ?) returning *"
		)
		const insertSession = db.query<unknown, [string, number, number, number]>(
			"insert into sessions (token_hash, user_id, created_at, expires_at) values (?, ?, ?, ?)"
		)
		const sessionRow = db.query<Row, [string, number]>(
			"select users.* from sessions join users on users.id = sessions.user_id where sessions.token_hash = ? and sessions.expires_at > ? and users.disabled = 0"
		)

		const dummyHash = yield* hash(newSecret())
		const failures = new Map<string, { count: number; since: number }>()
		let setupCode = count.get()?.n === 0 ? makeCode() : null
		if (setupCode !== null && announceSetup) {
			yield* Effect.logWarning(`No accounts yet. Open the web UI and enter this setup code to create the first admin: ${setupCode}`)
		}

		const findById = (id: number) =>
			Effect.sync(() => byId.get(id)).pipe(
				Effect.flatMap((row) =>
					row ? Effect.succeed(row) : Effect.fail(new ApiError.NotFound({ message: "That user doesn't exist." }))
				)
			)

		const keepsAnAdmin = (row: Row) =>
			Effect.sync(() => row.role !== "admin" || (activeAdmins.get(row.id)?.n ?? 0) > 0).pipe(
				Effect.flatMap((ok) =>
					ok ? Effect.void : Effect.fail(new ApiError.Conflict({ message: "Keep at least one active admin." }))
				)
			)

		const insert = (username: string, hashed: string, role: Role, mustChange: boolean) =>
			Effect.try({
				try: () => toUser(insertUser.get(username, hashed, role, mustChange ? 1 : 0, Date.now())!),
				catch: () => new ApiError.Conflict({ message: `The username ${username} is taken.` })
			})

		const endSessionsFor = (userId: number, except: string | null = null) =>
			Effect.sync(() =>
				except === null
					? db.run("delete from sessions where user_id = ?", [userId])
					: db.run("delete from sessions where user_id = ? and token_hash != ?", [userId, tokenHash(except)])
			)

		const throttle = (key: string) =>
			Effect.suspend(() => {
				const entry = failures.get(key)
				if (!entry || Date.now() - entry.since > FAILURE_WINDOW_MS || entry.count < MAX_FAILURES) return Effect.void
				const minutes = Math.ceil((entry.since + FAILURE_WINDOW_MS - Date.now()) / 60000)
				return Effect.fail(
					new ApiError.TooManyRequests({ message: `Too many failed sign-ins. Try again in ${minutes} minutes.` })
				)
			})

		const recordFailure = (key: string) =>
			Effect.sync(() => {
				const entry = failures.get(key)
				const fresh = !entry || Date.now() - entry.since > FAILURE_WINDOW_MS
				failures.set(key, fresh ? { count: 1, since: Date.now() } : { ...entry, count: entry.count + 1 })
			})

		const setupRequired = Effect.sync(() => count.get()?.n === 0)

		const setup = Effect.fn("Accounts.setup")(function* (code: string, username: string, password: string) {
			if (setupCode === null || !(yield* setupRequired)) {
				return yield* new ApiError.Conflict({ message: "The first admin already exists. Sign in instead." })
			}
			if (!sameSecret(code.trim(), setupCode)) {
				return yield* new ApiError.Unauthorized({ message: "That setup code is wrong. Copy it from the gateway log." })
			}
			const name = yield* checkUsername(username.trim())
			const hashed = yield* hash(yield* checkPassword(password))
			const user = yield* Effect.try({
				try: () =>
					db.transaction(() => {
						if ((count.get()?.n ?? 0) > 0) throw new Error("taken")
						return toUser(insertUser.get(name, hashed, "admin", 0, Date.now())!)
					})(),
				catch: () => new ApiError.Conflict({ message: "The first admin already exists. Sign in instead." })
			})
			setupCode = null
			return user
		})

		const login = Effect.fn("Accounts.login")(function* (username: string, password: string) {
			const key = username.trim().toLowerCase()
			yield* throttle(key)
			const row = byName.get(username.trim())
			const ok = yield* verify(password, row?.password_hash ?? dummyHash)
			if (!row || !ok) {
				yield* recordFailure(key)
				return yield* new ApiError.Unauthorized({ message: "Wrong username or password." })
			}
			if (row.disabled === 1) return yield* new ApiError.Forbidden({ message: "This account is disabled." })
			failures.delete(key)
			return toUser(row)
		})

		const createSession = (userId: number) =>
			Effect.sync(() => {
				const token = randomBytes(32).toString("base64url")
				const now = Date.now()
				db.run("delete from sessions where expires_at <= ?", [now])
				insertSession.run(tokenHash(token), userId, now, now + SESSION_MS)
				return token
			})

		const sessionUser = (token: string) =>
			Effect.sync(() => {
				const row = sessionRow.get(tokenHash(token), Date.now())
				return row ? toUser(row) : null
			})

		const endSession = (token: string) =>
			Effect.sync(() => void db.run("delete from sessions where token_hash = ?", [tokenHash(token)]))

		const changePassword = Effect.fn("Accounts.changePassword")(function* (
			userId: number,
			current: string,
			next: string,
			keepSession: string | null
		) {
			const row = yield* findById(userId)
			if (!(yield* verify(current, row.password_hash))) {
				return yield* new ApiError.Unauthorized({ message: "Your current password is wrong." })
			}
			const hashed = yield* hash(yield* checkPassword(next))
			db.run("update users set password_hash = ?, must_change_password = 0 where id = ?", [hashed, userId])
			yield* endSessionsFor(userId, keepSession)
		})

		const list = Effect.sync(() => all.all().map(toUser))

		const create = Effect.fn("Accounts.create")(function* (input: NewUser) {
			const name = yield* checkUsername(input.username.trim())
			const hashed = yield* hash(yield* checkPassword(input.password))
			return yield* insert(name, hashed, input.role, true)
		})

		const update = Effect.fn("Accounts.update")(function* (actor: User, id: number, change: UserUpdate) {
			const row = yield* findById(id)
			const role = change.role ?? row.role
			const disabled = change.disabled ?? row.disabled === 1
			const demoted = row.role === "admin" && (role !== "admin" || disabled)
			if (actor.id === id && (role !== row.role || disabled)) {
				return yield* new ApiError.Conflict({ message: "You can't change your own role or disable yourself." })
			}
			if (demoted) yield* keepsAnAdmin(row)
			db.run("update users set role = ?, disabled = ? where id = ?", [role, disabled ? 1 : 0, id])
			if (disabled) yield* endSessionsFor(id)
			return toUser(yield* findById(id))
		})

		const resetPassword = Effect.fn("Accounts.resetPassword")(function* (id: number, password: string) {
			yield* findById(id)
			const hashed = yield* hash(yield* checkPassword(password))
			db.run("update users set password_hash = ?, must_change_password = 1 where id = ?", [hashed, id])
			yield* endSessionsFor(id)
		})

		const remove = Effect.fn("Accounts.remove")(function* (actor: User, id: number) {
			if (actor.id === id) return yield* new ApiError.Conflict({ message: "You can't delete your own account." })
			const row = yield* findById(id)
			yield* keepsAnAdmin(row)
			db.run("delete from users where id = ?", [id])
		})

		return {
			setupRequired,
			setup,
			login,
			createSession,
			sessionUser,
			endSession,
			changePassword,
			list,
			create,
			update,
			resetPassword,
			remove
		} satisfies AccountsService
	})

export class Accounts extends Context.Service<Accounts, AccountsService>()("lore-webui/gateway/Accounts") {
	static readonly layer = Layer.effect(
		Accounts,
		Effect.gen(function* () {
			const { auth, dataDir } = yield* Settings
			if (auth === "off") return yield* makeAccounts(":memory:", { announceSetup: false })
			if (dataDir === ":memory:") return yield* makeAccounts(":memory:")
			mkdirSync(dataDir, { recursive: true })
			return yield* makeAccounts(join(dataDir, "lore-webui.db"))
		})
	)
}

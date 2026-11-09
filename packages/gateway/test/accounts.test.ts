import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { makeAccounts } from "../src/auth/Accounts.ts"
import { unsignedIdentityToken } from "../src/lore/identity.ts"

const CODE = "test-setup-code"
const ADMIN_PASSWORD = "correct horse battery"

const run = <A, E>(program: (accounts: Effect.Success<ReturnType<typeof makeAccounts>>) => Effect.Effect<A, E>) =>
	Effect.runPromise(
		Effect.scoped(
			Effect.flatMap(makeAccounts(":memory:", { announceSetup: false, setupCode: () => CODE }), program)
		)
	)

const failure = <A, E extends { _tag: string; message: string }>(effect: Effect.Effect<A, E>) =>
	Effect.flip(effect).pipe(Effect.map((error) => error._tag))

const withAdmin = (accounts: Effect.Success<ReturnType<typeof makeAccounts>>) => accounts.setup(CODE, "judd", ADMIN_PASSWORD)

describe("first admin setup", () => {
	test("needs the setup code and works once", async () => {
		const result = await run((accounts) =>
			Effect.gen(function* () {
				const before = yield* accounts.setupRequired
				const wrongCode = yield* failure(accounts.setup("nope", "judd", ADMIN_PASSWORD))
				const shortPassword = yield* failure(accounts.setup(CODE, "judd", "short"))
				const admin = yield* withAdmin(accounts)
				const again = yield* failure(accounts.setup(CODE, "other", ADMIN_PASSWORD))
				return { before, wrongCode, shortPassword, admin, again, after: yield* accounts.setupRequired }
			})
		)
		expect(result.before).toBe(true)
		expect(result.wrongCode).toBe("Unauthorized")
		expect(result.shortPassword).toBe("BadRequest")
		expect(result.admin).toMatchObject({ username: "judd", role: "admin", mustChangePassword: false })
		expect(result.again).toBe("Conflict")
		expect(result.after).toBe(false)
	})
})

describe("sign-in", () => {
	test("rejects a wrong password and locks the name after ten failures", async () => {
		const result = await run((accounts) =>
			Effect.gen(function* () {
				yield* withAdmin(accounts)
				const wrong = yield* failure(accounts.login("judd", "not the password"))
				for (let i = 0; i < 9; i++) yield* Effect.ignore(accounts.login("judd", "not the password"))
				const locked = yield* failure(accounts.login("JUDD", ADMIN_PASSWORD))
				return { wrong, locked }
			})
		)
		expect(result).toEqual({ wrong: "Unauthorized", locked: "TooManyRequests" })
	})

	test("sessions end on sign-out and when the account is disabled", async () => {
		const result = await run((accounts) =>
			Effect.gen(function* () {
				const admin = yield* withAdmin(accounts)
				const member = yield* accounts.create({ username: "artist", password: "temporary-pass-1", role: "member" })
				const adminSession = yield* accounts.createSession(admin.id)
				const memberSession = yield* accounts.createSession(member.id)
				const signedIn = (yield* accounts.sessionUser(memberSession))?.username
				yield* accounts.update(admin, member.id, { disabled: true })
				const afterDisable = yield* accounts.sessionUser(memberSession)
				yield* accounts.endSession(adminSession)
				return { signedIn, afterDisable, afterSignOut: yield* accounts.sessionUser(adminSession) }
			})
		)
		expect(result).toEqual({ signedIn: "artist", afterDisable: null, afterSignOut: null })
	})
})

describe("passwords", () => {
	test("a new user must change the password, and changing it ends other sessions", async () => {
		const result = await run((accounts) =>
			Effect.gen(function* () {
				yield* withAdmin(accounts)
				const created = yield* accounts.create({ username: "artist", password: "temporary-pass-1", role: "member" })
				const kept = yield* accounts.createSession(created.id)
				const other = yield* accounts.createSession(created.id)
				yield* accounts.changePassword(created.id, "temporary-pass-1", "artist-own-password", kept)
				const user = yield* accounts.login("artist", "artist-own-password")
				return {
					before: created.mustChangePassword,
					after: user.mustChangePassword,
					kept: (yield* accounts.sessionUser(kept)) !== null,
					other: yield* accounts.sessionUser(other)
				}
			})
		)
		expect(result).toEqual({ before: true, after: false, kept: true, other: null })
	})
})

describe("admin rules", () => {
	test("keeps one active admin and stops admins locking themselves out", async () => {
		const result = await run((accounts) =>
			Effect.gen(function* () {
				const admin = yield* withAdmin(accounts)
				const second = yield* accounts.create({ username: "lead", password: "temporary-pass-1", role: "admin" })
				const selfDemote = yield* failure(accounts.update(admin, admin.id, { role: "member" }))
				const selfDelete = yield* failure(accounts.remove(admin, admin.id))
				yield* accounts.update(admin, second.id, { role: "member" })
				const lastAdmin = yield* failure(accounts.update(second, admin.id, { disabled: true }))
				const duplicate = yield* failure(accounts.create({ username: "LEAD", password: "temporary-pass-1", role: "viewer" }))
				return { selfDemote, selfDelete, lastAdmin, duplicate }
			})
		)
		expect(result).toEqual({ selfDemote: "Conflict", selfDelete: "Conflict", lastAdmin: "Conflict", duplicate: "Conflict" })
	})
})

describe("unsigned identity token", () => {
	test("carries the claims Lore requires and names the user", () => {
		const [header, claims, signature] = unsignedIdentityToken("artist", 1_700_000_000_000).split(".")
		expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "HS256", typ: "JWT" })
		expect(JSON.parse(Buffer.from(claims!, "base64url").toString())).toEqual({
			iss: "lore-webui",
			sub: "artist",
			aud: ["lore"],
			iat: 1_700_000_000,
			exp: 1_700_000_300
		})
		expect(signature).not.toBe("")
	})
})

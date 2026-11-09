import { ApiError, LoreApi, type User } from "@lore-webui/api"
import { Effect, Layer } from "effect"
import type { HttpServerRequest } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { Accounts } from "../auth/Accounts.ts"
import { CurrentUser, requireRole } from "../auth/CurrentUser.ts"
import { SESSION_COOKIE, setSessionCookie } from "../auth/middleware.ts"
import { Settings } from "../config.ts"

const AuthHandlers = HttpApiBuilder.group(
	LoreApi,
	"auth",
	Effect.fn(function* (handlers) {
		const accounts = yield* Accounts
		const settings = yield* Settings

		const accountsOn =
			settings.auth === "accounts"
				? Effect.void
				: Effect.fail(new ApiError.BadRequest({ message: "Accounts are turned off on this gateway." }))

		const startSession = (request: HttpServerRequest.HttpServerRequest, user: User) =>
			accounts.createSession(user.id).pipe(
				Effect.flatMap((token) => setSessionCookie(request, token)),
				Effect.as(user)
			)

		return handlers.handleAll({
			status: () =>
				Effect.gen(function* () {
					if (settings.auth === "off") return { mode: "off" as const, setupRequired: false, user: null }
					const viewer = yield* CurrentUser
					return { mode: "accounts" as const, setupRequired: yield* accounts.setupRequired, user: viewer?.user ?? null }
				}),
			setup: ({ payload, request }) =>
				accountsOn.pipe(
					Effect.andThen(accounts.setup(payload.code, payload.username, payload.password)),
					Effect.flatMap((user) => startSession(request, user))
				),
			login: ({ payload, request }) =>
				accountsOn.pipe(
					Effect.andThen(accounts.login(payload.username, payload.password)),
					Effect.flatMap((user) => startSession(request, user))
				),
			logout: ({ request }) =>
				Effect.gen(function* () {
					const token = request.cookies[SESSION_COOKIE]
					if (token) yield* accounts.endSession(token)
					yield* setSessionCookie(request, null)
				}),
			password: ({ payload }) =>
				Effect.gen(function* () {
					yield* accountsOn
					const viewer = yield* CurrentUser
					if (!viewer) return yield* new ApiError.Unauthorized({ message: "Sign in to continue." })
					yield* accounts.changePassword(viewer.user.id, payload.current, payload.next, viewer.session)
				})
		})
	})
)

const UserHandlers = HttpApiBuilder.group(
	LoreApi,
	"users",
	Effect.fn(function* (handlers) {
		const accounts = yield* Accounts
		const admin = requireRole("admin")
		return handlers.handleAll({
			list: () => admin.pipe(Effect.andThen(accounts.list)),
			create: ({ payload }) => admin.pipe(Effect.andThen(accounts.create(payload))),
			update: ({ params, payload }) =>
				admin.pipe(Effect.flatMap((viewer) => accounts.update(viewer.user, params.id, payload))),
			resetPassword: ({ params, payload }) => admin.pipe(Effect.andThen(accounts.resetPassword(params.id, payload.password))),
			remove: ({ params }) => admin.pipe(Effect.flatMap((viewer) => accounts.remove(viewer.user, params.id)))
		})
	})
)

export const AccountHandlers = Layer.mergeAll(AuthHandlers, UserHandlers)

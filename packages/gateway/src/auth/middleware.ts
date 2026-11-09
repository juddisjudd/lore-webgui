import { Effect } from "effect"
import { HttpEffect, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http"
import { Settings } from "../config.ts"
import { Accounts } from "./Accounts.ts"
import { CurrentUser, OPEN_ACCESS } from "./CurrentUser.ts"

export const SESSION_COOKIE = "lore_session"

const PUBLIC = new Set([
	"/api/health",
	"/api/auth/status",
	"/api/auth/setup",
	"/api/auth/login",
	"/api/auth/logout",
	"/api/docs",
	"/api/openapi.json"
])

const reject = (status: 401 | 403, tag: "Unauthorized" | "Forbidden", message: string) =>
	HttpServerResponse.jsonUnsafe({ _tag: tag, message }, { status })

const isHttps = (request: HttpServerRequest.HttpServerRequest) =>
	request.headers["x-forwarded-proto"]?.split(",")[0]?.trim() === "https"

export const setSessionCookie = (request: HttpServerRequest.HttpServerRequest, token: string | null) =>
	HttpEffect.appendPreResponseHandler((_, response) =>
		Effect.succeed(
			HttpServerResponse.setCookieUnsafe(response, SESSION_COOKIE, token ?? "", {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: isHttps(request),
				maxAge: token === null ? 0 : "30 days"
			})
		)
	)

export const AuthMiddleware = HttpRouter.middleware(
	Effect.gen(function* () {
		const settings = yield* Settings
		const accounts = yield* Accounts
		return (app) =>
			Effect.gen(function* () {
				if (settings.auth === "off") return yield* Effect.provideService(app, CurrentUser, OPEN_ACCESS)
				const request = yield* HttpServerRequest.HttpServerRequest
				const path = request.url.split("?", 1)[0] ?? "/"
				const token = request.cookies[SESSION_COOKIE] ?? null
				const user = token ? yield* accounts.sessionUser(token) : null
				const viewer = user ? { user, session: token } : null
				const run = Effect.provideService(app, CurrentUser, viewer)
				if (!path.startsWith("/api/") || PUBLIC.has(path)) return yield* run
				if (!viewer) return reject(401, "Unauthorized", "Sign in to continue.")
				if (viewer.user.mustChangePassword && path !== "/api/auth/password") {
					return reject(403, "Forbidden", "Choose a new password before you continue.")
				}
				return yield* run
			})
	}),
	{ global: true }
)

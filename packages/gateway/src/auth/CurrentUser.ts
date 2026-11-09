import { ApiError, type Role, type User } from "@lore-webui/api"
import { Context, Effect } from "effect"

export interface Viewer {
	readonly user: User
	readonly session: string | null
}

export const CurrentUser = Context.Reference<Viewer | null>("lore-webui/gateway/CurrentUser", {
	defaultValue: () => null
})

export const OPEN_ACCESS: Viewer = {
	user: { id: 0, username: "", role: "admin", mustChangePassword: false, disabled: false, created: 0 },
	session: null
}

const rank: Record<Role, number> = { viewer: 0, member: 1, admin: 2 }

export const requireRole = (role: Role) =>
	Effect.gen(function* () {
		const viewer = yield* CurrentUser
		if (!viewer || rank[viewer.user.role] < rank[role]) {
			return yield* new ApiError.Forbidden({ message: `This needs the ${role} role.` })
		}
		return viewer
	})

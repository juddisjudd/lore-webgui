import { AsyncLocalStorage } from "node:async_hooks"

export const identity = new AsyncLocalStorage<string>()

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")

// Lore only reads these claims with trust_unsigned_identity on, and ignores the token otherwise.
export const unsignedIdentityToken = (username: string, now = Date.now()) => {
	const issuedAt = Math.floor(now / 1000)
	const header = encode({ alg: "HS256", typ: "JWT" })
	const claims = encode({ iss: "lore-webui", sub: username, aud: ["lore"], iat: issuedAt, exp: issuedAt + 300 })
	return `${header}.${claims}.${Buffer.from("unsigned").toString("base64url")}`
}

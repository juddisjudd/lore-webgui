import { Code, ConnectError } from "@connectrpc/connect"
import { ApiError } from "@lore-webui/api"

export const fromConnect = (error: unknown): ApiError.LoreError => {
	if (!(error instanceof ConnectError)) {
		const message = error instanceof Error ? error.message : String(error)
		return new ApiError.Unavailable({ message: `Lore server unreachable: ${message}` })
	}
	const message = error.rawMessage || Code[error.code]
	switch (error.code) {
		case Code.NotFound:
			return new ApiError.NotFound({ message })
		case Code.InvalidArgument:
		case Code.OutOfRange:
			return new ApiError.BadRequest({ message })
		case Code.AlreadyExists:
		case Code.FailedPrecondition:
		case Code.Aborted:
			return new ApiError.Conflict({ message })
		case Code.PermissionDenied:
		case Code.Unauthenticated:
			return new ApiError.Forbidden({ message })
		case Code.Unimplemented:
			return new ApiError.NotSupported({ message })
		case Code.Unavailable:
		case Code.DeadlineExceeded:
			return new ApiError.Unavailable({ message })
		default:
			return new ApiError.LoreFailure({ message, code: Code[error.code] ?? String(error.code) })
	}
}

export const badRequest = (message: string) => new ApiError.BadRequest({ message })

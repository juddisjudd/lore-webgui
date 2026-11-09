import { Schema } from "effect"

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", { message: Schema.String }, { httpApiStatus: 404 }) {}

export class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", { message: Schema.String }, { httpApiStatus: 400 }) {}

export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", { message: Schema.String }, { httpApiStatus: 409 }) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", { message: Schema.String }, { httpApiStatus: 403 }) {}

export class NotSupported extends Schema.TaggedError<NotSupported>()("NotSupported", { message: Schema.String }, { httpApiStatus: 501 }) {}

export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", { message: Schema.String }, { httpApiStatus: 503 }) {}

export class LoreFailure extends Schema.TaggedError<LoreFailure>()(
	"LoreFailure",
	{ message: Schema.String, code: Schema.String },
	{ httpApiStatus: 502 }
) {}

export const LoreErrors = [NotFound, BadRequest, Conflict, Forbidden, NotSupported, Unavailable, LoreFailure] as const

export type LoreError = InstanceType<(typeof LoreErrors)[number]>

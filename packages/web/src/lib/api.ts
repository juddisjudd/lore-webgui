import { LoreApi } from '@lore-webui/api';
import { error, redirect } from '@sveltejs/kit';
import { Context, Effect, Layer, ManagedRuntime, Result } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { HttpApiClient } from 'effect/http-api';

export type Client = HttpApiClient.ForApi<typeof LoreApi>;

class Api extends Context.Service<Api, Client>()('lore-webui/web/Api') {
	static readonly layer = Layer.effect(Api, HttpApiClient.make(LoreApi, { baseUrl: location.origin })).pipe(
		Layer.provide(FetchHttpClient.layer)
	);
}

const runtime = ManagedRuntime.make(Api.layer);

const statuses: Record<string, number> = {
	NotFound: 404,
	BadRequest: 400,
	Conflict: 409,
	Forbidden: 403,
	NotSupported: 501,
	Unavailable: 503,
	LoreFailure: 502,
	Unauthorized: 401,
	TooManyRequests: 429
};

export const loginPath = (next = location.pathname + location.search) =>
	next === '/' ? '/login' : `/login?${new URLSearchParams({ next })}`;

export interface Failure {
	readonly status: number;
	readonly message: string;
}

const describe = (cause: unknown): Failure => {
	if (typeof cause === 'object' && cause !== null) {
		const tag = '_tag' in cause ? String(cause._tag) : '';
		const message = 'message' in cause && typeof cause.message === 'string' ? cause.message : String(cause);
		return { status: statuses[tag] ?? 500, message: message || tag };
	}
	return { status: 500, message: String(cause) };
};

export async function attempt<A, E>(
	f: (client: Client) => Effect.Effect<A, E>
): Promise<{ ok: true; value: A } | { ok: false; error: Failure }> {
	const program = Effect.gen(function* () {
		return yield* f(yield* Api);
	});
	const result = await runtime.runPromise(Effect.result(program));
	return Result.isSuccess(result) ? { ok: true, value: result.success } : { ok: false, error: describe(result.failure) };
}

export async function load<A, E>(f: (client: Client) => Effect.Effect<A, E>): Promise<A> {
	const result = await attempt(f);
	if (result.ok) return result.value;
	if (result.error.status === 401) redirect(307, loginPath());
	error(result.error.status, result.error.message);
}

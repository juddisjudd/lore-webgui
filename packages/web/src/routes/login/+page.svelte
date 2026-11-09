<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { attempt } from '#lib/api.ts';
	import AuthCard from '#lib/AuthCard.svelte';

	let username = $state('');
	let password = $state('');
	let pending = $state(false);
	let failure = $state<string | null>(null);

	const next = $derived.by(() => {
		const target = page.url.searchParams.get('next') ?? '/';
		return target.startsWith('/') && !target.startsWith('//') ? target : '/';
	});

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		pending = true;
		failure = null;
		const result = await attempt((client) => client.auth.login({ payload: { username, password } }));
		pending = false;
		if (!result.ok) {
			failure = result.error.message;
			return;
		}
		await goto(result.value.mustChangePassword ? '/account' : next, { refreshAll: true });
	}
</script>

<svelte:head>
	<title>Sign in – Lore</title>
</svelte:head>

<AuthCard title="Sign in">
	<form onsubmit={submit}>
		<label class="field">
			<span>Username</span>
			<input class="input mono" bind:value={username} required autocomplete="username" spellcheck="false" />
		</label>
		<label class="field">
			<span>Password</span>
			<input class="input" type="password" bind:value={password} required autocomplete="current-password" />
		</label>
		{#if failure}<p class="error-text" role="alert">{failure}</p>{/if}
		<button class="button primary" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
	</form>
	<p class="muted">Ask an admin if you don't have an account.</p>
</AuthCard>

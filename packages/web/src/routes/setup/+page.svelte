<script lang="ts">
	import { goto } from '$app/navigation';
	import { attempt } from '#lib/api.ts';
	import AuthCard from '#lib/AuthCard.svelte';

	let code = $state('');
	let username = $state('');
	let password = $state('');
	let confirm = $state('');
	let pending = $state(false);
	let failure = $state<string | null>(null);

	const mismatch = $derived(confirm !== '' && confirm !== password);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (password !== confirm) return;
		pending = true;
		failure = null;
		const result = await attempt((client) => client.auth.setup({ payload: { code, username, password } }));
		pending = false;
		if (!result.ok) {
			failure = result.error.message;
			return;
		}
		await goto('/', { refreshAll: true });
	}
</script>

<svelte:head>
	<title>Set up – Lore</title>
</svelte:head>

<AuthCard title="Create the first admin">
	<p class="muted">
		Paste the setup code from the gateway's log. With Docker Compose, <code>docker compose logs lore-webgui</code> shows it.
	</p>
	<form onsubmit={submit}>
		<label class="field">
			<span>Setup code</span>
			<input class="input mono" bind:value={code} required autocomplete="off" spellcheck="false" />
		</label>
		<label class="field">
			<span>Username</span>
			<input class="input mono" bind:value={username} required autocomplete="username" spellcheck="false" />
		</label>
		<label class="field">
			<span>Password</span>
			<input class="input" type="password" bind:value={password} required minlength={12} autocomplete="new-password" />
		</label>
		<label class="field">
			<span>Confirm password</span>
			<input
				class="input"
				type="password"
				bind:value={confirm}
				required
				autocomplete="new-password"
				aria-invalid={mismatch}
			/>
		</label>
		{#if mismatch}
			<p class="error-text">The passwords don't match.</p>
		{:else if failure}
			<p class="error-text" role="alert">{failure}</p>
		{/if}
		<button class="button primary" disabled={pending || mismatch}>{pending ? 'Creating…' : 'Create admin'}</button>
	</form>
</AuthCard>

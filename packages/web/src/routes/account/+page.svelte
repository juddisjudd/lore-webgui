<script lang="ts">
	import { goto } from '$app/navigation';
	import { attempt } from '#lib/api.ts';
	import AuthCard from '#lib/AuthCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let current = $state('');
	let next = $state('');
	let confirm = $state('');
	let pending = $state(false);
	let failure = $state<string | null>(null);
	let changed = $state(false);

	const user = $derived(data.auth.user);
	const mismatch = $derived(confirm !== '' && confirm !== next);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (next !== confirm) return;
		pending = true;
		failure = null;
		changed = false;
		const result = await attempt((client) => client.auth.password({ payload: { current, next } }));
		pending = false;
		if (!result.ok) {
			failure = result.error.message;
			return;
		}
		current = next = confirm = '';
		if (user?.mustChangePassword) {
			await goto('/', { refreshAll: true });
			return;
		}
		changed = true;
	}
</script>

<svelte:head>
	<title>Account – Lore</title>
</svelte:head>

{#if data.auth.mode === 'off' || !user}
	<AuthCard title="Account">
		<p class="muted">Accounts are turned off on this gateway, so there is nothing to change here.</p>
	</AuthCard>
{:else}
	<AuthCard title={user.mustChangePassword ? 'Choose a new password' : 'Change your password'}>
		<p class="muted">
			Signed in as <strong class="mono" translate="no">{user.username}</strong>, with the {user.role} role.
			{#if user.mustChangePassword}An admin set your current password, so choose your own before you continue.{/if}
		</p>
		<form onsubmit={submit}>
			<label class="field">
				<span>Current password</span>
				<input class="input" type="password" bind:value={current} required autocomplete="current-password" />
			</label>
			<label class="field">
				<span>New password</span>
				<input class="input" type="password" bind:value={next} required minlength={12} autocomplete="new-password" />
			</label>
			<label class="field">
				<span>Confirm new password</span>
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
			{:else if changed}
				<p role="status">Password changed. Your other sessions were signed out.</p>
			{/if}
			<button class="button primary" disabled={pending || mismatch}>{pending ? 'Saving…' : 'Save password'}</button>
		</form>
	</AuthCard>
{/if}

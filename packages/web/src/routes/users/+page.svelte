<script lang="ts">
	import type { Role, User } from '@lore-webui/api';
	import { refreshAll } from '$app/navigation';
	import { attempt } from '#lib/api.ts';
	import { generatePassword } from '#lib/auth.ts';
	import { ago, when } from '#lib/format.ts';
	import Modal from '#lib/Modal.svelte';
	import Select from '#lib/Select.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const roles: ReadonlyArray<{ value: Role; label: string }> = [
		{ value: 'viewer', label: 'Viewer' },
		{ value: 'member', label: 'Member' },
		{ value: 'admin', label: 'Admin' }
	];

	const me = $derived(data.auth.user);

	let failure = $state<string | null>(null);
	let adding = $state(false);
	let newName = $state('');
	let newRole = $state<Role>('member');
	let newPassword = $state(generatePassword());
	let resetting = $state<User | null>(null);
	let resetPassword = $state('');
	let deleting = $state<User | null>(null);
	let pending = $state(false);
	let dialogFailure = $state<string | null>(null);
	let copied = $state(false);

	async function run(action: () => ReturnType<typeof attempt>, done?: () => void) {
		pending = true;
		dialogFailure = null;
		failure = null;
		const result = await action();
		pending = false;
		if (!result.ok) {
			if (adding || resetting || deleting) dialogFailure = result.error.message;
			else failure = result.error.message;
			await refreshAll();
			return;
		}
		done?.();
		await refreshAll();
	}

	function openAdd() {
		newName = '';
		newRole = 'member';
		newPassword = generatePassword();
		dialogFailure = null;
		adding = true;
	}

	function openReset(user: User) {
		resetPassword = generatePassword();
		dialogFailure = null;
		resetting = user;
	}

	async function copy(text: string) {
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	const add = (event: SubmitEvent) => {
		event.preventDefault();
		void run(
			() => attempt((client) => client.users.create({ payload: { username: newName, password: newPassword, role: newRole } })),
			() => (adding = false)
		);
	};

	const changeRole = (user: User, role: Role) =>
		run(() => attempt((client) => client.users.update({ params: { id: user.id }, payload: { role } })));

	const toggle = (user: User) =>
		run(() => attempt((client) => client.users.update({ params: { id: user.id }, payload: { disabled: !user.disabled } })));

	const reset = (event: SubmitEvent) => {
		event.preventDefault();
		const user = resetting;
		if (!user) return;
		void run(
			() => attempt((client) => client.users.resetPassword({ params: { id: user.id }, payload: { password: resetPassword } })),
			() => (resetting = null)
		);
	};

	const remove = (event: SubmitEvent) => {
		event.preventDefault();
		const user = deleting;
		if (!user) return;
		void run(
			() => attempt((client) => client.users.remove({ params: { id: user.id } })),
			() => (deleting = null)
		);
	};
</script>

<svelte:head>
	<title>Users – Lore</title>
</svelte:head>

<div class="head">
	<h1>Users</h1>
	<button class="button primary" onclick={openAdd}>Add user</button>
</div>

{#if failure}<p class="error-text" role="alert">{failure}</p>{/if}

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Username</th>
				<th scope="col">Role</th>
				<th scope="col">Added</th>
				<th scope="col"><span class="visually-hidden">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.users as user (user.id)}
				{@const self = user.id === me?.id}
				<tr class={{ disabled: user.disabled }}>
					<td>
						<span class="name">
							<span class="mono" translate="no">{user.username}</span>
							{#if self}<span class="badge">You</span>{/if}
							{#if user.disabled}<span class="badge">Disabled</span>{/if}
							{#if user.mustChangePassword && !user.disabled}<span class="badge">New password pending</span>{/if}
						</span>
					</td>
					<td>
						<Select
							label="Role for {user.username}"
							value={user.role}
							options={roles}
							disabled={self || pending}
							onchange={(role) => changeRole(user, role)}
						/>
					</td>
					<td class="added">
						<time datetime={new Date(user.created).toISOString()} title={when(user.created)}>{ago(user.created)}</time>
					</td>
					<td class="row-actions">
						{#if !self}
							<button class="button" onclick={() => openReset(user)}>Reset password</button>
							<button class="button" onclick={() => toggle(user)} disabled={pending}>
								{user.disabled ? 'Enable' : 'Disable'}
							</button>
							<button class="button danger" onclick={() => ((dialogFailure = null), (deleting = user))}>Delete</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<dl class="roles">
	<dt>Viewer</dt>
	<dd>Browses repositories, history and files.</dd>
	<dt>Member</dt>
	<dd>Also creates repositories and creates or deletes branches.</dd>
	<dt>Admin</dt>
	<dd>Also manages users.</dd>
</dl>

<Modal bind:open={adding} title="Add user">
	<form onsubmit={add}>
		<label class="field">
			<span>Username</span>
			<input class="input mono" bind:value={newName} required autocomplete="off" spellcheck="false" />
		</label>
		<div class="field">
			<span aria-hidden="true">Role</span>
			<Select label="Role" wide bind:value={newRole} options={roles} />
		</div>
		<div class="field">
			<span>Temporary password</span>
			<div class="secret">
				<input class="input mono" bind:value={newPassword} required minlength={12} aria-label="Temporary password" />
				<button type="button" class="button" onclick={() => copy(newPassword)} aria-live="polite">{copied ? 'Copied' : 'Copy'}</button>
			</div>
		</div>
		<p class="muted">Send this password to them. They choose their own at first sign-in.</p>
		{#if dialogFailure}<p class="error-text" role="alert">{dialogFailure}</p>{/if}
		<div class="actions">
			<button type="button" class="button" onclick={() => (adding = false)}>Cancel</button>
			<button class="button primary" disabled={pending}>{pending ? 'Adding…' : 'Add user'}</button>
		</div>
	</form>
</Modal>

<Modal
	bind:open={() => resetting !== null, (open) => {
		if (!open) resetting = null;
	}}
	title="Reset password"
>
	<form onsubmit={reset}>
		<p>
			<code>{resetting?.username}</code> gets this temporary password and is signed out everywhere. They choose their own at
			next sign-in.
		</p>
		<div class="secret">
			<input class="input mono" bind:value={resetPassword} required minlength={12} aria-label="Temporary password" />
			<button type="button" class="button" onclick={() => copy(resetPassword)} aria-live="polite">{copied ? 'Copied' : 'Copy'}</button>
		</div>
		{#if dialogFailure}<p class="error-text" role="alert">{dialogFailure}</p>{/if}
		<div class="actions">
			<button type="button" class="button" onclick={() => (resetting = null)}>Cancel</button>
			<button class="button primary" disabled={pending}>{pending ? 'Resetting…' : 'Reset password'}</button>
		</div>
	</form>
</Modal>

<Modal
	bind:open={() => deleting !== null, (open) => {
		if (!open) deleting = null;
	}}
	title="Delete user"
>
	<form onsubmit={remove}>
		<p>
			Delete <code>{deleting?.username}</code>? They are signed out and can't sign in again. What they made in Lore stays.
		</p>
		{#if dialogFailure}<p class="error-text" role="alert">{dialogFailure}</p>{/if}
		<div class="actions">
			<button type="button" class="button" onclick={() => (deleting = null)}>Cancel</button>
			<button class="button danger solid" disabled={pending}>{pending ? 'Deleting…' : 'Delete user'}</button>
		</div>
	</form>
</Modal>

<style>
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: var(--step-3);
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 40rem;
	}

	th {
		text-align: left;
		font-size: var(--step--1);
		font-weight: 600;
		color: var(--muted);
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--line);
	}

	td {
		padding: 0.6rem 1rem;
		border-bottom: 1px solid var(--line);
		vertical-align: middle;
	}

	tr:last-child td {
		border-bottom: 0;
	}

	tr.disabled .mono {
		color: var(--muted);
	}

	.name {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.badge {
		font-size: var(--step--1);
		font-weight: 400;
		padding: 0 0.45rem;
		border-radius: var(--radius-s);
		background: var(--raised);
		color: var(--muted);
	}

	td :global([role='combobox']) {
		--select-height: 2rem;
		min-width: 8rem;
	}

	.added {
		font-size: var(--step--1);
		color: var(--muted);
		white-space: nowrap;
	}

	.row-actions {
		width: 1%;
		text-align: right;
		white-space: nowrap;
	}

	.row-actions .button + .button {
		margin-left: 0.5rem;
	}

	.roles {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.35rem 1.25rem;
		margin-top: 1.5rem;
		font-size: var(--step--1);
		color: var(--muted);
	}

	.roles dt {
		font-family: var(--font-mono);
		color: var(--text);
	}

	form {
		display: grid;
		gap: 1rem;
	}

	.secret {
		display: flex;
		gap: 0.5rem;
	}

	.secret .input {
		flex: 1;
		min-width: 0;
	}
</style>

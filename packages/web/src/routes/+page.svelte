<script lang="ts">
	import { goto } from '$app/navigation';
	import { attempt } from '#lib/api.ts';
	import { can } from '#lib/auth.ts';
	import { ago, when } from '#lib/format.ts';
	import Composition from '#lib/Composition.svelte';
	import Modal from '#lib/Modal.svelte';
	import { nameProblem } from '#lib/names.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const reachable = $derived(data.server?.reachable ?? false);
	const canCreate = $derived(can(data.auth, 'member'));

	let creating = $state(false);
	let name = $state('');
	let description = $state('');
	let defaultBranchName = $state('main');
	let pending = $state(false);
	let failure = $state<string | null>(null);

	const problem = $derived(nameProblem(name, 'Repository') ?? nameProblem(defaultBranchName, 'Branch'));

	async function create(event: SubmitEvent) {
		event.preventDefault();
		pending = true;
		failure = null;
		const result = await attempt((client) =>
			client.repositories.create({ payload: { name: name.trim(), description, defaultBranchName } })
		);
		pending = false;
		if (!result.ok) {
			failure = result.error.message;
			return;
		}
		creating = false;
		await goto(`/r/${result.value.id}`);
	}

	function startCreate() {
		name = '';
		description = '';
		defaultBranchName = 'main';
		failure = null;
		creating = true;
	}
</script>

<svelte:head>
	<title>Repositories – Lore</title>
</svelte:head>

<div class="head">
	<h1>Repositories</h1>
	{#if reachable && canCreate && data.repositories.length > 0}
		<button class="button primary" onclick={startCreate}>New repository</button>
	{/if}
</div>

{#if data.repositories.length === 0}
	<div class="empty">
		{#if reachable}
			<p>This server has no repositories yet.</p>
			{#if canCreate}
				<button class="button primary" onclick={startCreate}>Create the first repository</button>
			{/if}
		{:else}
			<p>Start the Lore server, then reload this page.</p>
		{/if}
	</div>
{:else}
	<ul class="list">
		{#each data.repositories as repo (repo.id)}
			<li>
				<a class="name" href="/r/{repo.id}" translate="no">{repo.name}</a>
				{#if repo.description}
					<p class="description">{repo.description}</p>
				{/if}
				<div class="langs"><Composition repo={repo.id} branch={repo.defaultBranchId} compact /></div>
				<span class="branch mono" title="Default branch">{repo.defaultBranchName}</span>
				<time class="created muted" datetime={new Date(repo.created).toISOString()} title={when(repo.created)}>
					Created {ago(repo.created)}
				</time>
			</li>
		{/each}
	</ul>
{/if}

<Modal bind:open={creating} title="New repository">
	<form onsubmit={create}>
		<label class="field">
			<span>Name</span>
			<input
				class="input"
				name="name"
				bind:value={name}
				required
				autocomplete="off"
				spellcheck="false"
				placeholder="studio/my-game"
				aria-invalid={problem !== null}
			/>
		</label>
		<label class="field">
			<span>Description</span>
			<input class="input" name="description" bind:value={description} autocomplete="off" />
		</label>
		<label class="field">
			<span>Default branch</span>
			<input class="input mono" name="default-branch" bind:value={defaultBranchName} required autocomplete="off" spellcheck="false" />
		</label>
		{#if problem || failure}
			<p class="error-text" role="alert">{problem ?? failure}</p>
		{/if}
		<div class="actions">
			<button type="button" class="button" onclick={() => (creating = false)}>Cancel</button>
			<button class="button primary" disabled={pending || problem !== null || name.trim() === ''}>
				{pending ? 'Creating…' : 'Create repository'}
			</button>
		</div>
	</form>
</Modal>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: var(--step-3);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}

	.list li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		grid-template-areas:
			'name branch created'
			'description description description'
			'langs langs langs';
		align-items: baseline;
		column-gap: 1.5rem;
		row-gap: 0.15rem;
		padding: 1.15rem 0.75rem;
		border-bottom: 1px solid var(--line);
	}

	.list li:hover {
		background: var(--surface);
	}

	.langs {
		grid-area: langs;
		margin-top: 0.5rem;
	}

	.langs:empty {
		display: none;
	}

	.name {
		grid-area: name;
		font-family: var(--font-mono);
		font-size: var(--step-1);
		font-weight: 700;
		letter-spacing: -0.02em;
		text-decoration: none;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.name:hover {
		text-decoration: underline;
	}

	.description {
		grid-area: description;
		color: var(--muted);
	}

	.branch {
		grid-area: branch;
		color: var(--muted);
		font-size: var(--step--1);
	}

	.created {
		grid-area: created;
		font-size: var(--step--1);
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: 1rem;
		padding: 2.5rem 1.5rem;
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-m);
	}

	@media (max-width: 640px) {
		.list li {
			grid-template-columns: 1fr auto;
			grid-template-areas:
				'name branch'
				'description description'
				'langs langs'
				'created created';
		}
	}
</style>

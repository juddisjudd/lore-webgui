<script lang="ts">
	import type { Branch } from '@lore-webui/api';
	import { goto, refreshAll } from '$app/navigation';
	import { attempt } from '#lib/api.ts';
	import BranchDialog from '#lib/BranchDialog.svelte';
	import { ago, author, short, when } from '#lib/format.ts';
	import Modal from '#lib/Modal.svelte';
	import Sigil from '#lib/Sigil.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let creating = $state(false);
	let doomed = $state<Branch | null>(null);
	let deleting = $state(false);
	let failure = $state<string | null>(null);


	const branchPath = (branch: Branch) =>
		branch.name === data.repo.defaultBranchName
			? `/r/${data.repo.id}/files`
			: `/r/${data.repo.id}/files?branch=${encodeURIComponent(branch.name)}`;

	function askDelete(branch: Branch) {
		failure = null;
		doomed = branch;
	}

	async function remove() {
		if (!doomed) return;
		deleting = true;
		const target = doomed;
		const result = await attempt((client) =>
			client.branches.delete({ params: { repo: data.repo.id, branch: target.id } })
		);
		deleting = false;
		if (!result.ok) {
			failure = result.error.message;
			return;
		}
		doomed = null;
		if (target.id === data.branch.id) await goto(`/r/${data.repo.id}/branches`);
		await refreshAll();
	}
</script>

<div class="toolbar">
	<a
		class="toggle"
		href={data.showDeleted ? `/r/${data.repo.id}/branches` : `/r/${data.repo.id}/branches?deleted=1`}
	>
		{data.showDeleted ? 'Hide deleted branches' : 'Show deleted branches'}
	</a>
	<button class="button primary" onclick={() => (creating = true)} disabled={data.branches.every((b) => !b.latest)}>
		New branch
	</button>
</div>

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				<th scope="col">Branch</th>
				<th scope="col">Latest revision</th>
				<th scope="col">Created</th>
				<th scope="col"><span class="visually-hidden">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.all as branch (branch.id)}
				<tr class={{ deleted: branch.deleted }}>
					<td>
						<div class="name">
							{#if branch.deleted}
								<span class="mono">{branch.name}</span>
								<span class="badge del">Deleted</span>
							{:else}
								<a class="mono" href={branchPath(branch)}>{branch.name}</a>
							{/if}
							{#if branch.id === data.repo.defaultBranchId}<span class="badge">Default</span>{/if}
							{#if branch.category}<span class="badge">{branch.category}</span>{/if}
						</div>
					</td>
					<td>
						{#if branch.latest}
							<a class="tip mono" href="/r/{data.repo.id}/rev/{branch.latest}" title={branch.latest}>
								<Sigil signature={branch.latest} size={18} />
								{short(branch.latest)}
							</a>
						{:else}
							<span class="muted">No revisions</span>
						{/if}
					</td>
					<td class="created">
						<time datetime={new Date(branch.created).toISOString()} title={when(branch.created)}>{ago(branch.created)}</time>
						<span class="muted">{author(branch.creator)}</span>
					</td>
					<td class="row-actions">
						{#if !branch.deleted && branch.id !== data.repo.defaultBranchId}
							<button class="button danger" onclick={() => askDelete(branch)} aria-label="Delete {branch.name}">Delete</button>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<BranchDialog bind:open={creating} repo={data.repo.id} branches={data.branches} from={data.branch} />

<Modal
	bind:open={() => doomed !== null, (open) => {
		if (!open) doomed = null;
	}}
	title="Delete branch"
>
	<form
		onsubmit={(event) => {
			event.preventDefault();
			void remove();
		}}
	>
		<p>
			Delete <code>{doomed?.name}</code>? Its revisions stay in the repository, but the name is freed and the branch
			disappears from lists.
		</p>
		{#if failure}<p class="error-text" role="alert">{failure}</p>{/if}
		<div class="actions">
			<button type="button" class="button" onclick={() => (doomed = null)}>Cancel</button>
			<button class="button danger solid" disabled={deleting}>{deleting ? 'Deleting…' : 'Delete branch'}</button>
		</div>
	</form>
</Modal>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.toggle {
		color: var(--muted);
		font-size: var(--step--1);
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
		min-width: 36rem;
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

	tr.deleted td {
		color: var(--muted);
	}

	.name {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.name a {
		font-weight: 600;
	}

	.badge {
		font-size: var(--step--1);
		padding: 0 0.45rem;
		border-radius: var(--radius-s);
		background: var(--raised);
		color: var(--muted);
	}

	.badge.del {
		background: var(--del-wash);
		color: var(--del);
	}

	.tip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
		font-size: var(--step--1);
	}

	.tip:hover {
		text-decoration: underline;
	}

	.created {
		display: grid;
		font-size: var(--step--1);
	}

	.row-actions {
		text-align: right;
		width: 1%;
	}
</style>

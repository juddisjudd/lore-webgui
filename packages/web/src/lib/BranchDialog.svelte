<script lang="ts">
	import type { Branch } from '@lore-webui/api';
	import { goto } from '$app/navigation';
	import { attempt } from '#lib/api.ts';
	import { short } from '#lib/format.ts';
	import Modal from '#lib/Modal.svelte';
	import { nameProblem } from '#lib/names.ts';

	let {
		open = $bindable(false),
		repo,
		branches,
		from,
		at = null
	}: { open?: boolean; repo: string; branches: ReadonlyArray<Branch>; from: Branch; at?: string | null } = $props();

	let name = $state('');
	let source = $derived(from.id);
	let pending = $state(false);
	let failure = $state<string | null>(null);

	const problem = $derived(nameProblem(name, 'Branch'));
	const live = $derived(branches.filter((b) => !b.deleted && b.latest));

	async function create(event: SubmitEvent) {
		event.preventDefault();
		pending = true;
		failure = null;
		const payload = at ? { name: name.trim(), fromBranchId: source, fromSignature: at } : { name: name.trim(), fromBranchId: source };
		const result = await attempt((client) => client.branches.create({ params: { repo }, payload }));
		pending = false;
		if (!result.ok) {
			failure = result.error.message;
			return;
		}
		open = false;
		name = '';
		await goto(`/r/${repo}/files?branch=${encodeURIComponent(result.value.name)}`, { refreshAll: true });
	}
</script>

<Modal bind:open title="New branch">
	<form onsubmit={create}>
		<label class="field">
			<span>Name</span>
			<input
				class="input mono"
				name="name"
				bind:value={name}
				required
				autocomplete="off"
				spellcheck="false"
				placeholder="feature/new-level"
				aria-invalid={problem !== null}
			/>
		</label>
		{#if at}
			<p class="muted">Starts at revision <code>{short(at)}</code> of {from.name}.</p>
		{:else}
			<label class="field">
				<span>Starts from the latest revision of</span>
				<select class="input mono" name="source" bind:value={source}>
					{#each live as branch (branch.id)}
						<option value={branch.id}>{branch.name}</option>
					{/each}
				</select>
			</label>
		{/if}
		{#if problem || failure}
			<p class="error-text" role="alert">{problem ?? failure}</p>
		{/if}
		<div class="actions">
			<button type="button" class="button" onclick={() => (open = false)}>Cancel</button>
			<button class="button primary" disabled={pending || problem !== null || name.trim() === ''}>
				{pending ? 'Creating…' : 'Create branch'}
			</button>
		</div>
	</form>
</Modal>

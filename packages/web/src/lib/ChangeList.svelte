<script lang="ts">
	import type { Change } from '@lore-webui/api';
	import type { Snippet } from 'svelte';
	import ChangeItem from '#lib/ChangeItem.svelte';

	let {
		repo,
		changes,
		empty,
		note,
		footer
	}: {
		repo: string;
		changes: ReadonlyArray<Change>;
		empty: string;
		note?: Snippet;
		footer?: Snippet;
	} = $props();

	const headingId = $props.id();

	const visible = $derived(
		changes.filter(
			(c) =>
				c.action !== 'unchanged' &&
				!(c.kind === 'directory' && changes.some((other) => other.path.startsWith(`${c.path}/`)))
		)
	);
	const counts = $derived({
		added: visible.filter((c) => c.action === 'added').length,
		modified: visible.filter((c) => c.action === 'modified' || c.action === 'moved' || c.action === 'copied').length,
		deleted: visible.filter((c) => c.action === 'deleted').length
	});
	const autoOpen = $derived(visible.length <= 5);
</script>

<section class="changes" aria-labelledby={headingId}>
	<div class="changes-head">
		<h3 id={headingId}>
			{visible.length === 1 ? '1 change' : `${visible.length} changes`}
			{@render note?.()}
		</h3>
		<span class="counts">
			{#if counts.added}<span class="add">{counts.added} added</span>{/if}
			{#if counts.modified}<span class="mod">{counts.modified} changed</span>{/if}
			{#if counts.deleted}<span class="del">{counts.deleted} deleted</span>{/if}
		</span>
	</div>
	{#if visible.length === 0}
		<p class="none muted">{empty}</p>
	{:else}
		<ul>
			{#each visible as change (change.path)}
				<ChangeItem {repo} {change} open={autoOpen} />
			{/each}
		</ul>
	{/if}
	{@render footer?.()}
</section>

<style>
	.changes {
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface);
		overflow: hidden;
	}

	.changes-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--line);
		background: var(--raised);
	}

	h3 {
		font-size: var(--step-0);
	}

	.counts {
		display: flex;
		gap: 1rem;
		font-size: var(--step--1);
		font-weight: 600;
	}

	.add {
		color: var(--add);
	}

	.mod {
		color: var(--muted);
	}

	.del {
		color: var(--del);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.none {
		padding: 1rem;
	}
</style>

<script lang="ts">
	import type { RevisionRef } from '@lore-webui/api';
	import BranchDialog from '#lib/BranchDialog.svelte';
	import ChangeItem from '#lib/ChangeItem.svelte';
	import { ago, author, firstLine, short, when } from '#lib/format.ts';
	import { withRef } from '#lib/links.ts';
	import Sigil from '#lib/Sigil.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let branching = $state(false);

	const rev = $derived(data.revision);
	const branchNames = $derived(new Map(data.branches.map((b) => [b.id, b.name])));
	const owner = $derived(data.branches.find((b) => b.id === rev.branchId));
	const title = $derived(firstLine(rev.message));
	const body = $derived(rev.message.slice(rev.message.indexOf('\n') + 1).trim());
	const hasBody = $derived(rev.message.includes('\n') && body !== '');

	const visible = $derived(
		data.changes.changes.filter(
			(c) =>
				c.action !== 'unchanged' &&
				!(c.kind === 'directory' && data.changes.changes.some((other) => other.path.startsWith(`${c.path}/`)))
		)
	);
	const counts = $derived({
		added: visible.filter((c) => c.action === 'added').length,
		modified: visible.filter((c) => c.action === 'modified' || c.action === 'moved' || c.action === 'copied').length,
		deleted: visible.filter((c) => c.action === 'deleted').length
	});
	const autoOpen = $derived(visible.length <= 5);

	const browse = $derived(
		withRef(`/r/${data.repo.id}/files`, {
			branch: owner && owner.name !== data.repo.defaultBranchName ? owner.name : null,
			rev: rev.signature
		})
	);
</script>

<svelte:head>
	<title>{title} – {data.repo.name}</title>
</svelte:head>

{#snippet refLink(label: string, ref: RevisionRef)}
	<a class="ref" href="/r/{data.repo.id}/rev/{ref.signature}">
		<span class="muted">{label}</span>
		<Sigil signature={ref.signature} size={18} />
		<span class="mono">#{ref.number}</span>
		{#if ref.branchId !== rev.branchId && branchNames.has(ref.branchId)}
			<span class="mono muted">{branchNames.get(ref.branchId)}</span>
		{/if}
	</a>
{/snippet}

<article>
	<header class="head">
		<Sigil signature={rev.signature} size={56} />
		<div class="heading">
			<p class="where">
				<span class="mono number">#{rev.number}</span>
				{#if owner}
					<span>on <a class="mono" href={withRef(`/r/${data.repo.id}/history`, { branch: owner.name === data.repo.defaultBranchName ? null : owner.name })}>{owner.name}</a></span>
				{/if}
			</p>
			<h2>{title}</h2>
			{#if hasBody}<p class="body">{body}</p>{/if}
			<p class="meta">
				<span>{author(rev.createdBy)}</span>
				{#if rev.committedBy && rev.committedBy !== rev.createdBy}<span>Committed by {author(rev.committedBy)}</span>{/if}
				<time datetime={new Date(rev.timestamp).toISOString()} title={when(rev.timestamp)}>{ago(rev.timestamp)}</time>
			</p>
		</div>
		<div class="actions">
			<a class="button" href={browse}>Browse files</a>
			{#if owner}<button class="button" onclick={() => (branching = true)}>Branch from here</button>{/if}
		</div>
	</header>

	<div class="lineage">
		{#if rev.parent}{@render refLink('Parent', rev.parent)}{/if}
		{#if rev.mergeParent}{@render refLink('Merged from', rev.mergeParent)}{/if}
		<code class="signature" title="Revision signature">{rev.signature}</code>
	</div>

	{#if rev.metadata.length > 0}
		<details class="metadata">
			<summary>Metadata ({rev.metadata.length})</summary>
			<dl>
				{#each rev.metadata as entry (entry.key)}
					<dt class="mono">{entry.key}</dt>
					<dd class="mono">{entry.value}</dd>
				{/each}
			</dl>
		</details>
	{/if}

	<section class="changes" aria-labelledby="changes-title">
		<div class="changes-head">
			<h3 id="changes-title">
				{visible.length === 1 ? '1 change' : `${visible.length} changes`}
				{#if data.changes.from && data.changes.from.signature !== rev.parent?.signature}
					<span class="muted">since <a class="mono" href="/r/{data.repo.id}/rev/{data.changes.from.signature}">{short(data.changes.from.signature)}</a></span>
				{/if}
			</h3>
			<span class="counts">
				{#if counts.added}<span class="add">{counts.added} added</span>{/if}
				{#if counts.modified}<span class="mod">{counts.modified} changed</span>{/if}
				{#if counts.deleted}<span class="del">{counts.deleted} deleted</span>{/if}
			</span>
		</div>
		{#if visible.length === 0}
			<p class="none muted">No file changes in this revision.</p>
		{:else}
			<ul>
				{#each visible as change (change.path)}
					<ChangeItem repo={data.repo.id} {change} open={autoOpen} />
				{/each}
			</ul>
		{/if}
		{#if data.changes.conflicts.length > 0}
			<p class="conflicts">{data.changes.conflicts.length} conflicting paths between the merged sides.</p>
		{/if}
	</section>
</article>

{#if owner}
	<BranchDialog bind:open={branching} repo={data.repo.id} branches={data.branches} from={owner} at={rev.signature} />
{/if}

<style>
	article {
		display: grid;
		gap: 1.25rem;
	}

	.head {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 1.25rem;
		align-items: start;
	}

	.heading {
		display: grid;
		gap: 0.35rem;
		min-width: 0;
	}

	.where {
		display: flex;
		gap: 0.75rem;
		align-items: baseline;
		color: var(--muted);
	}

	.number {
		color: var(--text);
		font-weight: 700;
		font-size: var(--step-1);
	}

	h2 {
		font-size: var(--step-2);
		overflow-wrap: anywhere;
	}

	.body {
		white-space: pre-wrap;
		max-width: 72ch;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1.25rem;
		color: var(--muted);
		font-size: var(--step--1);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: end;
	}

	.lineage {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem 1.5rem;
		padding: 0.75rem 0;
		border-block: 1px solid var(--line);
		font-size: var(--step--1);
	}

	.ref {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		text-decoration: none;
	}

	.ref:hover .mono {
		text-decoration: underline;
	}

	.signature {
		margin-left: auto;
		color: var(--muted);
		overflow-wrap: anywhere;
		user-select: all;
	}

	.metadata summary {
		cursor: pointer;
		color: var(--muted);
		font-size: var(--step--1);
	}

	dl {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.25rem 1.5rem;
		margin: 0.75rem 0 0;
		font-size: var(--step--1);
	}

	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

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

	.none,
	.conflicts {
		padding: 1rem;
	}

	.conflicts {
		border-top: 1px solid var(--line);
		color: var(--text);
	}

	@media (max-width: 720px) {
		.head {
			grid-template-columns: auto 1fr;
		}

		.actions {
			grid-column: 1 / -1;
			justify-content: start;
		}

		.signature {
			margin-left: 0;
		}
	}
</style>

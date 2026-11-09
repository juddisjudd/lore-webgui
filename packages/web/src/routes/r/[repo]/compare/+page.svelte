<script lang="ts">
	import { goto } from '$app/navigation';
	import ChangeItem from '#lib/ChangeItem.svelte';
	import ChangeList from '#lib/ChangeList.svelte';
	import { ago, author, firstLine, when } from '#lib/format.ts';
	import Sigil from '#lib/Sigil.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const c = $derived(data.comparison);
	const live = $derived(data.branches.filter((b) => !b.deleted));
	const showsChanges = $derived(c.status === 'ahead' || c.status === 'diverged' || c.status === 'unrelated');
	const canMerge = $derived(c.status === 'ahead' || c.status === 'diverged');
	const mergeCommand = $derived(`lore branch switch ${c.base.name}\nlore branch merge ${c.head.name}`);

	let copied = $state(false);

	const revisions = (n: number) => (n === 1 ? '1 revision' : `${n} revisions`);
	const files = (n: number) => (n === 1 ? '1 file' : `${n} files`);

	function compareUrl(base: string, head: string) {
		const query = new URLSearchParams({ base, head });
		return `/r/${data.repo.id}/compare?${query}`;
	}

	function pick(side: 'base' | 'head', event: Event) {
		const name = (event.currentTarget as HTMLSelectElement).value;
		void goto(side === 'base' ? compareUrl(name, c.head.name) : compareUrl(c.base.name, name));
	}

	async function copyMerge() {
		await navigator.clipboard.writeText(mergeCommand);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

<svelte:head>
	<title>{c.head.name} into {c.base.name} – {data.repo.name}</title>
</svelte:head>

<div class="pick">
	<label>
		<span>Base</span>
		<select class="mono" value={c.base.name} onchange={(event) => pick('base', event)}>
			{#each live as branch (branch.id)}<option value={branch.name}>{branch.name}</option>{/each}
		</select>
	</label>
	<span class="arrow" aria-hidden="true">←</span>
	<label>
		<span>Compare</span>
		<select class="mono" value={c.head.name} onchange={(event) => pick('head', event)}>
			{#each live as branch (branch.id)}<option value={branch.name}>{branch.name}</option>{/each}
		</select>
	</label>
	<a class="button" href={compareUrl(c.head.name, c.base.name)}>Swap</a>
</div>

<div class={['verdict', c.conflicts.length > 0 && 'conflicted']}>
	<p>
		{#if c.status === 'identical'}
			<strong class="mono">{c.head.name}</strong> and <strong class="mono">{c.base.name}</strong> point at the same revision.
		{:else if c.status === 'empty'}
			{c.head.latest ? c.base.name : c.head.name} has no revisions yet.
		{:else if c.status === 'behind'}
			<strong class="mono">{c.head.name}</strong> has nothing that <strong class="mono">{c.base.name}</strong> lacks.
			{c.base.name} is {revisions(c.behind ?? 0)} ahead.
		{:else if c.status === 'ahead'}
			<strong class="mono">{c.head.name}</strong> has {revisions(c.ahead ?? 0)} that
			<strong class="mono">{c.base.name}</strong> doesn't, and {c.base.name} has nothing new. They merge without conflicts.
		{:else if c.status === 'diverged'}
			<strong class="mono">{c.head.name}</strong> has {revisions(c.ahead ?? 0)} that
			<strong class="mono">{c.base.name}</strong> doesn't, and {c.base.name} has {revisions(c.behind ?? 0)} that
			{c.head.name} doesn't.
			{#if c.conflicts.length > 0}
				{files(c.conflicts.length)} {c.conflicts.length === 1 ? 'conflicts' : 'conflict'} and must be resolved in the merge.
			{:else}
				They merge without conflicts.
			{/if}
		{:else}
			<strong class="mono">{c.head.name}</strong> and <strong class="mono">{c.base.name}</strong> share no history. The list
			shows every difference.
		{/if}
	</p>
	{#if c.mergeBase && c.status !== 'behind'}
		<a class="base" href="/r/{data.repo.id}/rev/{c.mergeBase.signature}">
			<span class="muted">Branched at</span>
			<Sigil signature={c.mergeBase.signature} size={18} />
			<span class="mono">#{c.mergeBase.number}</span>
		</a>
	{/if}
</div>

{#if c.conflicts.length > 0}
	<section class="panel" aria-labelledby="conflicts-title">
		<h3 id="conflicts-title">{files(c.conflicts.length)} changed on both branches</h3>
		<ul>
			{#each c.conflicts as conflict (conflict.ours.path)}
				<ChangeItem repo={data.repo.id} change={conflict.ours} label={c.head.name} />
				<ChangeItem repo={data.repo.id} change={conflict.theirs} label={c.base.name} />
			{/each}
		</ul>
	</section>
{/if}

{#if c.revisions.length > 0}
	<section class="panel" aria-labelledby="revisions-title">
		<h3 id="revisions-title">{revisions(c.revisions.length)} on {c.head.name}</h3>
		<ol>
			{#each c.revisions as revision (revision.signature)}
				<li>
					<Sigil signature={revision.signature} size={18} />
					<a class="message" href="/r/{data.repo.id}/rev/{revision.signature}">{firstLine(revision.message)}</a>
					<span class="meta">
						<span class="mono">#{revision.number}</span>
						<span>{author(revision.createdBy)}</span>
						<time datetime={new Date(revision.timestamp).toISOString()} title={when(revision.timestamp)}>
							{ago(revision.timestamp)}
						</time>
					</span>
				</li>
			{/each}
		</ol>
	</section>
{/if}

{#if showsChanges}
	<ChangeList repo={data.repo.id} changes={c.changes} empty="No file differences." />
{/if}

{#if canMerge}
	<div class="merge">
		<p class="muted">Merge from a clone of the repository:</p>
		<div class="command">
			<pre translate="no">{mergeCommand}</pre>
			<button class="button" onclick={copyMerge} aria-live="polite">{copied ? 'Copied' : 'Copy'}</button>
		</div>
	</div>
{/if}

<style>
	.pick {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 0.75rem 1rem;
		margin-bottom: 1rem;
	}

	label {
		display: grid;
		gap: 0.3rem;
		font-size: var(--step--1);
		color: var(--muted);
	}

	select {
		min-height: 2.1rem;
		max-width: 20rem;
		padding: 0 0.6rem;
		border: 1px solid var(--line-strong);
		background-color: var(--bg);
		color: var(--text);
		font-size: var(--step-0);
	}

	.arrow {
		padding-bottom: 0.35rem;
		color: var(--muted);
	}

	@media (max-width: 40rem) {
		.arrow {
			display: none;
		}
	}

	.verdict {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.5rem;
		padding: 0.85rem 1rem;
		margin-bottom: 1rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-m);
	}

	.verdict.conflicted {
		border-color: var(--del);
	}

	.verdict p {
		max-width: 70ch;
	}

	.verdict strong {
		font-weight: 650;
	}

	.base {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		text-decoration: none;
		font-size: var(--step--1);
	}

	.base:hover .mono {
		text-decoration: underline;
	}

	.panel {
		margin-bottom: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface);
		overflow: hidden;
	}

	h3 {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--line);
		background: var(--raised);
		font-size: var(--step-0);
	}

	ul,
	ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	ol li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem 0.75rem;
		padding: 0.55rem 1rem;
		border-bottom: 1px solid var(--line);
	}

	ol li:last-child {
		border-bottom: 0;
	}

	.message {
		flex: 1;
		min-width: 12rem;
		font-weight: 600;
		text-decoration: none;
	}

	.message:hover {
		text-decoration: underline;
	}

	.meta {
		display: flex;
		gap: 1rem;
		font-size: var(--step--1);
		color: var(--muted);
	}

	.merge {
		display: grid;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.command {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		gap: 0.75rem;
	}

	.command pre {
		margin: 0;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-s);
		background: var(--raised);
		font-family: var(--font-mono);
		overflow-x: auto;
	}
</style>

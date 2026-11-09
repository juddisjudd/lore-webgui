<script lang="ts">
	import type { Change, FileDiff } from '@lore-webui/api';
	import { attempt } from '#lib/api.ts';
	import DiffView from '#lib/DiffView.svelte';
	import { previewFor, rawUrl } from '#lib/files.ts';
	import Glyph from '#lib/Glyph.svelte';
	import { glyphFor } from '#lib/glyphs.ts';

	let { repo, change, open = false }: { repo: string; change: Change; open?: boolean } = $props();

	const markers = { added: 'A', deleted: 'D', modified: 'M', moved: 'R', copied: 'C', unchanged: '=' } as const;
	const name = $derived(change.path.slice(change.path.lastIndexOf('/') + 1));
	const preview = $derived(previewFor(name));
	const expandable = $derived(change.kind !== 'directory' && (change.contentFrom !== null || change.contentTo !== null));

	let expanded = $derived(open && expandable);
	let cached: Promise<FileDiff> | null = null;
	const diff = $derived(expanded && preview !== 'image' ? (cached ??= fetchDiff()) : null);

	async function fetchDiff(): Promise<FileDiff> {
		const query = {
			...(change.contentFrom ? { from: change.contentFrom } : {}),
			...(change.contentTo ? { to: change.contentTo } : {})
		};
		const result = await attempt((client) => client.content.diff({ params: { repo }, query }));
		if (!result.ok) throw new Error(result.error.message);
		return result.value;
	}
</script>

{#snippet row()}
	<span class="marker mono" title={change.action}>{markers[change.action]}</span>
	<span class="kind"><Glyph d={glyphFor(name, change.kind)} /></span>
	<span class="path mono" translate="no">
		{#if change.pathFrom && change.pathFrom !== change.path}<span class="from">{change.pathFrom}</span>
			<span class="muted">to</span>
		{/if}{change.path}{change.kind === 'directory' ? '/' : ''}
	</span>
	{#if change.automerged}<span class="flag">Auto-merged</span>{/if}
	{#if change.linked}<span class="flag">Linked repository</span>{/if}
{/snippet}

<li class={['change', change.action]}>
	{#if !expandable}
		<div class="summary">{@render row()}</div>
	{:else}
		<details bind:open={expanded}>
			<summary class="summary">{@render row()}</summary>
			{#if expanded}
				<div class="detail">
					{#if preview === 'image'}
						<div class="images">
							{#if change.contentFrom}
								<figure>
									<img src={rawUrl(repo, change.contentFrom, name)} alt="{name} before" loading="lazy" />
									<figcaption>Before</figcaption>
								</figure>
							{/if}
							{#if change.contentTo}
								<figure>
									<img src={rawUrl(repo, change.contentTo, name)} alt="{name} after" loading="lazy" />
									<figcaption>After</figcaption>
								</figure>
							{/if}
						</div>
					{:else if diff}
						{#await diff}
							<p class="loading">Loading diff…</p>
						{:then value}
							<DiffView diff={value} />
						{:catch problem}
							<p class="loading error-text">Couldn't load the diff: {problem.message}</p>
						{/await}
					{/if}
				</div>
			{/if}
		</details>
	{/if}
</li>

<style>
	.change {
		border-bottom: 1px solid var(--line);
	}

	.change:last-child {
		border-bottom: 0;
	}

	.summary {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.55rem 1rem;
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary.summary {
		cursor: pointer;
	}

	summary:hover {
		background: var(--raised);
	}

	.marker {
		flex: none;
		display: grid;
		place-items: center;
		width: 1.4rem;
		height: 1.4rem;
		border-radius: var(--radius-s);
		font-weight: 700;
		font-size: var(--step--1);
	}

	.added .marker {
		background: var(--add-wash);
		color: var(--add);
	}

	.deleted .marker {
		background: var(--del-wash);
		color: var(--del);
	}

	.modified .marker,
	.moved .marker,
	.copied .marker,
	.unchanged .marker {
		background: var(--raised);
		color: var(--text);
	}

	.kind {
		display: grid;
		place-items: center;
		color: var(--muted);
	}

	.deleted .kind {
		opacity: 0.6;
	}

	.path {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.deleted .path {
		text-decoration: line-through;
		text-decoration-color: var(--del);
	}

	.from {
		color: var(--muted);
	}

	.flag {
		margin-left: auto;
		font-size: var(--step--1);
		color: var(--text);
		white-space: nowrap;
	}

	.detail {
		border-top: 1px solid var(--line);
	}

	.loading {
		padding: 1rem;
		color: var(--muted);
	}

	.images {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 1rem;
		padding: 1rem;
	}

	figure {
		margin: 0;
		display: grid;
		gap: 0.4rem;
		justify-items: center;
		padding: 1rem;
		border-radius: var(--radius-s);
		background: var(--bg);
	}

	figure img {
		max-width: 100%;
		max-height: 40vh;
		min-width: min(10rem, 100%);
		object-fit: contain;
		image-rendering: pixelated;
	}

	figcaption {
		font-size: var(--step--1);
		color: var(--muted);
	}
</style>

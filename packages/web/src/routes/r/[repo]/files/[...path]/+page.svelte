<script lang="ts">
	import { ago, author, bytes, firstLine, when } from '#lib/format.ts';
	import FileView from '#lib/FileView.svelte';
	import Glyph from '#lib/Glyph.svelte';
	import { glyphFor, glyphs } from '#lib/glyphs.ts';
	import { filesPath, withRef } from '#lib/links.ts';
	import Sigil from '#lib/Sigil.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ref = $derived({
		branch: data.branch.name === data.repo.defaultBranchName ? null : data.branch.name,
		rev: data.rev
	});
	const segments = $derived(data.path ? data.path.split('/') : []);
	const crumbs = $derived(segments.map((name, i) => ({ name, path: segments.slice(0, i + 1).join('/') })));
	const parentPath = $derived(segments.slice(0, -1).join('/'));
	const cloneUrl = $derived(`lore://${data.server.grpcUrl.replace(/^\w+:\/\//, '')}/${data.repo.name}`);

	let copied = $state(false);

	async function copyClone() {
		await navigator.clipboard.writeText(`lore clone ${cloneUrl}`);
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}
</script>

{#if data.revision}
	<div class="latest">
		<Sigil signature={data.revision.signature} size={28} />
		<div class="summary">
			<a class="message" href="/r/{data.repo.id}/rev/{data.revision.signature}">{firstLine(data.revision.message)}</a>
			<span class="muted">
				<span class="mono">#{data.revision.number}</span>
				<span>{author(data.revision.createdBy)}</span>
				<time datetime={new Date(data.revision.timestamp).toISOString()} title={when(data.revision.timestamp)}>
					{ago(data.revision.timestamp)}
				</time>
			</span>
		</div>
		{#if data.rev}
			<a class="button" href={withRef(filesPath(data.repo.id, data.path), { branch: ref.branch })}>
				Show latest on {data.branch.name}
			</a>
		{/if}
	</div>
{/if}

{#if crumbs.length > 0}
	<nav class="crumbs mono" aria-label="Path" translate="no">
		<a href={withRef(filesPath(data.repo.id), ref)}>{data.repo.name}</a>
		{#each crumbs as crumb, i (crumb.path)}
			<span aria-hidden="true">/</span>
			{#if i === crumbs.length - 1}
				<span aria-current="page">{crumb.name}</span>
			{:else}
				<a href={withRef(filesPath(data.repo.id, crumb.path), ref)}>{crumb.name}</a>
			{/if}
		{/each}
	</nav>
{/if}

{#if !data.listing}
	<div class="empty">
		<h2>{data.branch.name} has no revisions yet</h2>
		<p class="muted">Clone the repository, add files, then commit and push.</p>
		<div class="command">
			<code translate="no">lore clone {cloneUrl}</code>
			<button class="button" onclick={copyClone} aria-live="polite">{copied ? 'Copied' : 'Copy'}</button>
		</div>
	</div>
{:else if data.listing.entry && data.listing.entry.kind !== 'directory'}
	<FileView repo={data.repo.id} entry={data.listing.entry} />
{:else}
	<table class="listing">
		<thead class="visually-hidden">
			<tr><th>Name</th><th>Size</th></tr>
		</thead>
		<tbody>
			{#if segments.length > 0}
				<tr>
					<td colspan="2">
						<a class="entry" href={withRef(filesPath(data.repo.id, parentPath), ref)}>
							<span class="icon"><Glyph d={glyphs.up} /></span>
							<span class="muted">Parent directory</span>
						</a>
					</td>
				</tr>
			{/if}
			{#each data.listing.children as child (child.path)}
				<tr>
					<td>
						<a class="entry" href={withRef(filesPath(data.repo.id, child.path), ref)}>
							<span class={['icon', child.kind]}><Glyph d={glyphFor(child.name, child.kind)} /></span>
							<span class="name">{child.name}</span>
							{#if child.kind === 'link'}<span class="tag">link</span>{/if}
						</a>
					</td>
					<td class="size">{bytes(child.size)}</td>
				</tr>
			{:else}
				<tr><td colspan="2" class="muted">This directory is empty.</td></tr>
			{/each}
		</tbody>
	</table>
{/if}

<style>
	.latest {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface);
	}

	.summary {
		display: grid;
		min-width: 0;
		flex: 1;
	}

	.summary > span {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
		font-size: var(--step--1);
	}

	.message {
		font-weight: 600;
		text-decoration: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.message:hover {
		color: var(--text);
	}

	.crumbs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 1rem;
		font-size: var(--step-0);
	}

	.crumbs span[aria-hidden] {
		color: var(--muted);
	}

	.crumbs [aria-current] {
		font-weight: 650;
	}

	.listing {
		width: 100%;
		border-collapse: collapse;
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface);
		overflow: hidden;
	}

	.listing td {
		padding: 0;
		border-bottom: 1px solid var(--line);
	}

	.listing tr:last-child td {
		border-bottom: 0;
	}

	.listing td.muted {
		padding: 1rem;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		padding: 0.55rem 1rem;
		text-decoration: none;
		min-width: 0;
	}

	.entry:hover {
		background: var(--raised);
	}

	.entry:hover .name {
		text-decoration: underline;
	}

	.icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 16px;
		color: var(--muted);
	}

	.icon.directory {
		color: var(--text);
	}

	.name {
		font-family: var(--font-mono);
		font-size: 0.92em;
		overflow-wrap: anywhere;
	}

	.tag {
		font-size: var(--step--1);
		color: var(--muted);
	}

	.size {
		width: 1%;
		padding-inline: 1rem !important;
		white-space: nowrap;
		text-align: right;
		color: var(--muted);
		font-size: var(--step--1);
	}

	.empty {
		display: grid;
		gap: 0.75rem;
		padding: 2rem 1.5rem;
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-m);
	}

	.empty h2 {
		font-size: var(--step-2);
	}

	.command {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
	}

	.command code {
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-s);
		background: var(--raised);
		overflow-wrap: anywhere;
	}
</style>

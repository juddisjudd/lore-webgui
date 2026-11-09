<script lang="ts">
	import type { TreeEntry } from '@lore-webui/api';
	import { bytes } from '#lib/format.ts';
	import { MAX_TEXT_PREVIEW, previewFor, rawUrl } from '#lib/files.ts';

	let { repo, entry }: { repo: string; entry: TreeEntry } = $props();

	const kind = $derived(entry.size > MAX_TEXT_PREVIEW && previewFor(entry.name) === 'text' ? 'binary' : previewFor(entry.name));
	const src = $derived(entry.address ? rawUrl(repo, entry.address, entry.name) : '');
	const download = $derived(entry.address ? rawUrl(repo, entry.address, entry.name, true) : '');

	let dimensions = $state<string | null>(null);

	async function readText(url: string): Promise<Array<string> | null> {
		const response = await fetch(url);
		if (!response.ok) throw new Error(await response.text());
		const buffer = new Uint8Array(await response.arrayBuffer());
		if (buffer.subarray(0, 8000).includes(0)) return null;
		const text = new TextDecoder().decode(buffer);
		const lines = text.split(/\r?\n/);
		if (lines.length > 1 && lines.at(-1) === '') lines.pop();
		return lines;
	}

	const text = $derived(kind === 'text' && src ? readText(src) : null);
</script>

<section class="file" aria-label={entry.name}>
	<header>
		<span class="meta">
			<span>{bytes(entry.size)}</span>
			{#if dimensions}<span>{dimensions}</span>{/if}
			{#if entry.executable}<span>Executable</span>{/if}
		</span>
		{#if download}
			<a class="button" href={download} download={entry.name}>Download</a>
		{/if}
	</header>

	{#if !entry.address}
		<p class="placeholder">This entry has no content address.</p>
	{:else if kind === 'image'}
		<div class="stage">
			<img
				{src}
				alt={entry.name}
				onload={(event) => {
					const img = event.currentTarget as HTMLImageElement;
					dimensions = `${img.naturalWidth} × ${img.naturalHeight}`;
				}}
			/>
		</div>
	{:else if kind === 'audio'}
		<div class="stage"><audio controls preload="metadata" {src}></audio></div>
	{:else if kind === 'video'}
		<div class="stage"><video controls preload="metadata" {src}><track kind="captions" /></video></div>
	{:else if kind === 'binary'}
		<p class="placeholder">No preview for this file type. Download it to open it locally.</p>
	{:else if text}
		{#await text}
			<p class="placeholder">Loading…</p>
		{:then lines}
			{#if lines === null}
				<p class="placeholder">This file looks binary. Download it to open it locally.</p>
			{:else}
				<pre class="code" translate="no"><code>{#each lines as line, index (index)}<span class="line">{line}
</span>{/each}</code></pre>
			{/if}
		{:catch problem}
			<p class="placeholder error-text">Couldn't load this file: {problem.message}</p>
		{/await}
	{/if}
</section>

<style>
	.file {
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface);
		overflow: hidden;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.5rem 0.5rem 0.5rem 1rem;
		border-bottom: 1px solid var(--line);
		background: var(--raised);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 1.25rem;
		color: var(--muted);
		font-size: var(--step--1);
	}

	.placeholder {
		padding: 2rem 1rem;
		color: var(--muted);
	}

	.stage {
		display: grid;
		place-items: center;
		padding: 2rem 1rem;
		min-height: 12rem;
		background-color: var(--bg);
		background-image:
			linear-gradient(45deg, var(--raised) 25%, transparent 25%),
			linear-gradient(-45deg, var(--raised) 25%, transparent 25%),
			linear-gradient(45deg, transparent 75%, var(--raised) 75%),
			linear-gradient(-45deg, transparent 75%, var(--raised) 75%);
		background-size: 16px 16px;
		background-position: 0 0, 0 8px, 8px -8px, -8px 0;
	}

	.stage img {
		max-width: 100%;
		max-height: 70vh;
		image-rendering: pixelated;
		min-width: min(16rem, 100%);
		object-fit: contain;
	}

	.stage video {
		max-width: 100%;
		max-height: 70vh;
	}

	.code {
		margin: 0;
		padding: 0.75rem 0;
		overflow-x: auto;
		font-size: var(--step--1);
		line-height: 1.6;
		counter-reset: line;
		tab-size: 4;
	}

	.line {
		display: block;
		padding-right: 1rem;
		white-space: pre;
	}

	.line::before {
		counter-increment: line;
		content: counter(line);
		display: inline-block;
		width: 4.5ch;
		margin-right: 1.25rem;
		padding-right: 0.75rem;
		text-align: right;
		color: var(--muted);
		border-right: 1px solid var(--line);
		user-select: none;
	}

	.line:hover {
		background: var(--raised);
	}
</style>

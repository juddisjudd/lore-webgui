<script lang="ts" module>
	import type { AssetKind } from '@lore-webui/api';

	const nouns: Record<AssetKind, [string, string]> = {
		textures: ['texture', 'textures'],
		models: ['model', 'models'],
		audio: ['sound', 'sounds'],
		video: ['video', 'videos'],
		fonts: ['font', 'fonts'],
		unreal: ['Unreal asset', 'Unreal assets'],
		unity: ['Unity asset', 'Unity assets'],
		godot: ['Godot resource', 'Godot resources']
	};
</script>

<script lang="ts">
	import type { RepositoryStats } from '@lore-webui/api';
	import { attempt } from '#lib/api.ts';
	import { bytes } from '#lib/format.ts';
	import Glyph from '#lib/Glyph.svelte';
	import { assetGlyphs } from '#lib/glyphs.ts';

	let {
		repo,
		branch,
		compact = false
	}: { repo: string; branch: string; compact?: boolean } = $props();

	const SHADES = [100, 68, 44, 26];
	const OTHER_SHADE = 12;
	const count = new Intl.NumberFormat();

	async function fetchStats(repoId: string, branchId: string): Promise<RepositoryStats | null> {
		const result = await attempt((client) =>
			client.repositories.stats({ params: { repo: repoId }, query: { branch: branchId } })
		);
		return result.ok ? result.value : null;
	}

	const stats = $derived(fetchStats(repo, branch));

	function languages(data: RepositoryStats) {
		const top = data.code.languages.slice(0, compact ? 3 : SHADES.length);
		const rest = data.code.languages.slice(top.length);
		const items = top.map((language, i) => ({ name: language.name, share: language.share, shade: SHADES[i] ?? OTHER_SHADE }));
		if (!compact && rest.length > 0) {
			items.push({ name: 'Other', share: rest.reduce((sum, l) => sum + l.share, 0), shade: OTHER_SHADE });
		}
		return items;
	}

	const percent = (share: number) => (share < 0.005 ? '<1%' : `${Math.round(share * 100)}%`);
	const noun = (kind: AssetKind, files: number) => nouns[kind][files === 1 ? 0 : 1];
</script>

{#snippet languageBadges(data: RepositoryStats)}
	<ul class="badges" aria-label="Languages">
		{#each languages(data) as item (item.name)}
			<li style:--shade="{item.shade}%">
				<span class="swatch" aria-hidden="true"></span>
				<span translate="no">{item.name}</span>
				<span class="quiet">{percent(item.share)}</span>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet assetBadges(data: RepositoryStats)}
	<ul class="badges" aria-label="Assets">
		{#each compact ? data.assets.slice(0, 3) : data.assets as asset (asset.kind)}
			<li title="{count.format(asset.files)} {noun(asset.kind, asset.files)}, {bytes(asset.bytes)}">
				<Glyph d={assetGlyphs[asset.kind]} />
				<span><strong>{count.format(asset.files)}</strong> {noun(asset.kind, asset.files)}</span>
				{#if !compact}<span class="quiet">{bytes(asset.bytes)}</span>{/if}
			</li>
		{/each}
	</ul>
{/snippet}

{#await stats}
	{#if !compact}<div class="bar placeholder" aria-hidden="true"></div>{/if}
{:then data}
	{#if data && compact}
		{#if data.code.languages.length > 0 || data.assets.length > 0}
			<div class="compact">
				{#if data.code.languages.length > 0}{@render languageBadges(data)}{/if}
				{#if data.assets.length > 0}{@render assetBadges(data)}{/if}
			</div>
		{/if}
	{:else if data && data.signature}
		<dl class="composition">
			<dt>Code</dt>
			<dd>
				{#if data.code.languages.length > 0}
					<div class="bar" role="img" aria-label="Languages by size">
						{#each languages(data) as item (item.name)}
							<span style:flex-grow={item.share} style:--shade="{item.shade}%"></span>
						{/each}
					</div>
					{@render languageBadges(data)}
				{:else}
					<span class="quiet">No source code</span>
				{/if}
			</dd>
			{#if data.assets.length > 0}
				<dt>Assets</dt>
				<dd>{@render assetBadges(data)}</dd>
			{/if}
		</dl>
	{/if}
{/await}

<style>
	.composition {
		display: grid;
		grid-template-columns: 4.5rem 1fr;
		gap: 0.85rem 1rem;
		margin: 0;
	}

	dt {
		padding-top: 0.2rem;
		font-family: var(--font-mono);
		font-size: var(--step--1);
		color: var(--muted);
	}

	dd {
		display: grid;
		gap: 0.6rem;
		margin: 0;
		min-width: 0;
	}

	.bar {
		display: flex;
		gap: 2px;
		height: 6px;
		max-width: 44rem;
		margin-top: 0.15rem;
	}

	.bar span {
		flex-basis: 0;
		min-width: 3px;
		background: color-mix(in oklab, var(--text) var(--shade), var(--bg));
	}

	.placeholder {
		max-width: 44rem;
		background: var(--raised);
	}

	.compact {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem 1.25rem;
	}

	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.15rem 0.5rem;
		border: 1px solid var(--line);
		font-family: var(--font-mono);
		font-size: var(--step--1);
		line-height: 1.4;
		white-space: nowrap;
	}

	.compact li {
		padding: 0.05rem 0.4rem;
	}

	strong {
		font-weight: 700;
	}

	.swatch {
		width: 0.55rem;
		height: 0.55rem;
		background: color-mix(in oklab, var(--text) var(--shade), var(--bg));
		outline: 1px solid var(--line-strong);
		outline-offset: -1px;
	}

	.quiet {
		color: var(--muted);
	}

	@media (max-width: 560px) {
		.composition {
			grid-template-columns: 1fr;
			gap: 0.4rem;
		}

		dd + dt {
			margin-top: 0.6rem;
		}
	}
</style>

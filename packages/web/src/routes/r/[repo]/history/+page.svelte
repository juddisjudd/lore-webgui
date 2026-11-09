<script lang="ts">
	import type { Revision } from '@lore-webui/api';
	import { attempt } from '#lib/api.ts';
	import { ago, author, dayKey, dayLabel, firstLine, short, when } from '#lib/format.ts';
	import Sigil from '#lib/Sigil.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let extra = $derived.by((): Array<Revision> => {
		void data.page;
		return [];
	});
	let cursor = $derived<string | null>(data.page.older);
	let loading = $state(false);
	let failure = $state<string | null>(null);

	const items = $derived(
		[...data.page.items, ...extra].filter(
			(item, index, all) => all.findIndex((other) => other.signature === item.signature) === index
		)
	);

	const days = $derived.by(() => {
		const groups: Array<{ key: string; label: string; items: Array<Revision> }> = [];
		for (const item of items) {
			const key = dayKey(item.timestamp);
			const last = groups.at(-1);
			if (last?.key === key) last.items.push(item);
			else groups.push({ key, label: dayLabel(item.timestamp), items: [item] });
		}
		return groups;
	});

	const branchNames = $derived(new Map(data.branches.map((b) => [b.id, b.name])));

	async function loadOlder() {
		if (!cursor) return;
		loading = true;
		failure = null;
		const at = cursor;
		const result = await attempt((client) =>
			client.branches.history({ params: { repo: data.repo.id, branch: data.branch.id }, query: { cursor: at } })
		);
		loading = false;
		if (!result.ok) {
			failure = result.error.message;
			return;
		}
		extra = [...extra, ...result.value.items];
		cursor = result.value.older && result.value.older !== at ? result.value.older : null;
	}
</script>

{#if items.length === 0}
	<p class="empty muted">{data.branch.name} has no revisions yet.</p>
{:else}
	<div class="chronicle">
		{#each days as day (day.key)}
			<section>
				<h2>{day.label}</h2>
				<ol>
					{#each day.items as item (item.signature)}
						<li>
							<span class="number mono">{item.number}</span>
							<Sigil signature={item.signature} size={22} />
							<div class="body">
								<a class="message" href="/r/{data.repo.id}/rev/{item.signature}">{firstLine(item.message)}</a>
								<span class="meta">
									<span>{author(item.createdBy)}</span>
									<time datetime={new Date(item.timestamp).toISOString()} title={when(item.timestamp)}>
										{ago(item.timestamp)}
									</time>
									{#if item.branchId !== data.branch.id && branchNames.has(item.branchId)}
										<span class="inherited mono">{branchNames.get(item.branchId)}</span>
									{/if}
									{#if item.mergeParent}<span class="merge">Merge</span>{/if}
								</span>
							</div>
							<a class="signature mono" href="/r/{data.repo.id}/rev/{item.signature}" title={item.signature}>
								{short(item.signature)}
							</a>
						</li>
					{/each}
				</ol>
			</section>
		{/each}
	</div>

	{#if cursor || failure}
		<div class="more">
			{#if failure}<p class="error-text" role="alert">{failure}</p>{/if}
			{#if cursor}
				<button class="button" onclick={loadOlder} disabled={loading}>
					{loading ? 'Loading…' : 'Load older revisions'}
				</button>
			{/if}
		</div>
	{/if}
{/if}

<style>
	.chronicle {
		display: grid;
		gap: 1.75rem;
	}

	h2 {
		font-size: var(--step-0);
		font-weight: 650;
		color: var(--muted);
		margin-bottom: 0.5rem;
	}

	ol {
		list-style: none;
		margin: 0;
		padding: 0;
		border-left: 2px solid var(--line);
		margin-left: 2.25rem;
	}

	li {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.6rem 0.75rem 0.6rem 1.1rem;
		border-bottom: 1px solid var(--line);
	}

	li:last-child {
		border-bottom: 0;
	}

	li:hover {
		background: var(--surface);
	}

	.number {
		position: absolute;
		right: calc(100% + 0.75rem);
		width: 2rem;
		text-align: right;
		color: var(--text);
		font-weight: 700;
		font-size: var(--step-0);
	}

	.body {
		display: grid;
		flex: 1;
		min-width: 0;
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

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1rem;
		color: var(--muted);
		font-size: var(--step--1);
	}

	.inherited {
		color: var(--muted);
	}

	.merge {
		color: var(--text);
	}

	.signature {
		color: var(--muted);
		font-size: var(--step--1);
		text-decoration: none;
	}

	.signature:hover {
		color: var(--text);
		text-decoration: underline;
	}

	.more {
		display: grid;
		justify-items: start;
		gap: 0.5rem;
		margin-top: 1.5rem;
		margin-left: 2.25rem;
	}

	.empty {
		padding: 2rem 0;
	}

	@media (max-width: 560px) {
		.signature {
			display: none;
		}
	}
</style>

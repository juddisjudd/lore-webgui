<script lang="ts">
	import { ago, lockOwner, when } from '#lib/format.ts';
	import Glyph from '#lib/Glyph.svelte';
	import { glyphFor } from '#lib/glyphs.ts';
	import { filesPath, withRef } from '#lib/links.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const branch = $derived(data.branch.name === data.repo.defaultBranchName ? null : data.branch.name);
	const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
</script>

{#if !data.locks.ok}
	<div class="empty">
		{#if data.locks.error.status === 501}
			<h2>File locks are turned off on this server</h2>
			<p class="muted">Turn on the lock service in the Lore server's configuration to see locks here.</p>
		{:else}
			<h2>Locks could not be loaded</h2>
			<p class="error-text">{data.locks.error.message}</p>
		{/if}
	</div>
{:else if data.locks.value.length === 0}
	<div class="empty">
		<h2>No files are locked on {data.branch.name}</h2>
		<p class="muted">Lock a file from a clone before you edit it, so others know to wait:</p>
		<code translate="no">lore lock acquire &lt;path&gt;</code>
	</div>
{:else}
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th scope="col">File</th>
					<th scope="col">Locked by</th>
					<th scope="col">Since</th>
				</tr>
			</thead>
			<tbody>
				{#each data.locks.value as lock (lock.path)}
					<tr>
						<td>
							<a class="file" href={withRef(filesPath(data.repo.id, lock.path), { branch })} translate="no">
								<span class="icon"><Glyph d={glyphFor(baseName(lock.path), 'file')} /></span>
								<span class="mono">{lock.path}</span>
							</a>
						</td>
						<td class="owner">{lockOwner(lock.owner)}</td>
						<td class="since">
							{#if lock.lockedAt !== null}
								<time datetime={new Date(lock.lockedAt).toISOString()} title={when(lock.lockedAt)}>{ago(lock.lockedAt)}</time>
							{:else}
								<span class="muted">Unknown</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<style>
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: var(--radius-m);
		background: var(--surface);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 32rem;
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

	.file {
		display: inline-flex;
		align-items: center;
		gap: 0.65rem;
		text-decoration: none;
		overflow-wrap: anywhere;
	}

	.file:hover .mono {
		text-decoration: underline;
	}

	.file .mono {
		font-size: 0.92em;
	}

	.icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 16px;
		color: var(--muted);
	}

	.owner,
	.since {
		width: 1%;
		white-space: nowrap;
		font-size: var(--step--1);
	}

	@media (max-width: 40rem) {
		table {
			min-width: 0;
		}

		thead {
			display: none;
		}

		tr {
			display: flex;
			flex-wrap: wrap;
			gap: 0.3rem 1rem;
			padding: 0.6rem 1rem;
			border-bottom: 1px solid var(--line);
		}

		tr:last-child {
			border-bottom: 0;
		}

		td {
			padding: 0;
			border: 0;
		}

		td:first-child {
			flex-basis: 100%;
		}

		.owner,
		.since {
			width: auto;
			color: var(--muted);
		}
	}

	.empty {
		display: grid;
		justify-items: start;
		gap: 0.75rem;
		padding: 2rem 1.5rem;
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-m);
	}

	.empty h2 {
		font-size: var(--step-2);
	}

	.empty code {
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-s);
		background: var(--raised);
	}
</style>

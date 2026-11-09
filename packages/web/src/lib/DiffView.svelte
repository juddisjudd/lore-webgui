<script lang="ts">
	import type { FileDiff, Hunk } from '@lore-webui/api';

	let { diff }: { diff: FileDiff } = $props();

	const span = (start: number, count: number) => (count === 1 ? `line ${start}` : `lines ${start}–${start + count - 1}`);

	function label(hunk: Hunk): string {
		if (hunk.oldLines === 0) return `New ${span(hunk.newStart, hunk.newLines)}`;
		if (hunk.newLines === 0) return `Old ${span(hunk.oldStart, hunk.oldLines)}`;
		return `Old ${span(hunk.oldStart, hunk.oldLines)}, new ${span(hunk.newStart, hunk.newLines)}`;
	}
</script>

{#if diff.tooLarge}
	<p class="note">Too large to diff here.</p>
{:else if diff.binary}
	<p class="note">Binary content changed.</p>
{:else if diff.hunks.length === 0}
	<p class="note">No line changes.</p>
{:else}
	<div class="scroll">
		<table class="diff mono" translate="no">
			{#each diff.hunks as hunk, h (h)}
				<tbody>
					<tr class="hunk">
						<td colspan="3">{label(hunk)}</td>
					</tr>
					{#each hunk.lines as line, i (i)}
						<tr class={line.kind}>
							<td class="no">{line.oldNo ?? ''}</td>
							<td class="no">{line.newNo ?? ''}</td>
							<td class="text"><span class="sign" aria-hidden="true">{line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' '}</span>{line.text}</td>
						</tr>
					{/each}
				</tbody>
			{/each}
		</table>
	</div>
{/if}

<style>
	.note {
		padding: 1rem;
		color: var(--muted);
	}

	.scroll {
		overflow-x: auto;
	}

	.diff {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--step--1);
		line-height: 1.55;
		tab-size: 4;
	}

	.hunk td {
		padding: 0.3rem 1rem;
		background: var(--raised);
		color: var(--muted);
		font-family: var(--font-ui);
	}

	.no {
		width: 1%;
		min-width: 3.5ch;
		padding: 0 0.6rem;
		text-align: right;
		color: var(--muted);
		user-select: none;
		vertical-align: top;
	}

	.text {
		padding: 0 1rem 0 0.25rem;
		white-space: pre;
	}

	.sign {
		display: inline-block;
		width: 1.5ch;
		user-select: none;
	}

	.add {
		background: var(--add-wash);
	}

	.add .sign,
	.add .no {
		color: var(--add);
	}

	.del {
		background: var(--del-wash);
	}

	.del .sign,
	.del .no {
		color: var(--del);
	}
</style>

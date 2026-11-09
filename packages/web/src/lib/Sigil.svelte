<script lang="ts">
	let { signature, size = 20 }: { signature: string; size?: number } = $props();

	const cells = $derived.by(() => {
		const byte = (i: number) => parseInt(signature.slice(i * 2, i * 2 + 2), 16) || 0;
		const bits = (byte(0) << 8) | byte(1);
		const out: Array<[number, number]> = [];
		for (let i = 0; i < 15; i++) {
			if (((bits >> i) & 1) === 0) continue;
			const col = i % 3;
			const row = Math.floor(i / 3);
			out.push([col, row]);
			if (col < 2) out.push([4 - col, row]);
		}
		if (out.length < 4) out.push([2, 1], [2, 2], [2, 3]);
		return out;
	});
</script>

<svg class="sigil" width={size} height={size} viewBox="-1 -1 7 7" role="img" aria-label="Revision sigil">
	<rect x="-1" y="-1" width="7" height="7" class="ground" />
	{#each cells as [x, y] (`${x}:${y}`)}
		<rect {x} {y} width="1" height="1" class="cell" />
	{/each}
</svg>

<style>
	.sigil {
		flex: none;
		display: block;
		shape-rendering: crispEdges;
	}

	.ground {
		fill: var(--raised);
		stroke: var(--line-strong);
		stroke-width: 0.12;
	}

	.cell {
		fill: var(--text);
	}
</style>

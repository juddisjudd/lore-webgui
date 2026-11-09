<script lang="ts">
	let { d, size = 14 }: { d: string; size?: number } = $props();
</script>

<svg viewBox="0 0 7 7" width={size} height={size} aria-hidden="true"><path {d} /></svg>

<style>
	svg {
		flex: none;
		fill: currentColor;
		shape-rendering: crispEdges;
	}
</style>

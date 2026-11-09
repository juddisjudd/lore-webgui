<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<section class="card">
	<h1>{title}</h1>
	{@render children()}
</section>

<style>
	.card {
		display: grid;
		gap: 1.25rem;
		max-width: 26rem;
		margin: 1rem auto 0;
	}

	h1 {
		font-size: var(--step-2);
	}

	.card :global(form) {
		display: grid;
		gap: 1rem;
	}

	.card :global(form .button) {
		justify-self: start;
	}
</style>

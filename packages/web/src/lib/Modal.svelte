<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open = $bindable(false),
		title,
		children
	}: { open?: boolean; title: string; children: Snippet } = $props();

	const id = $props.id();

	function sync(dialog: HTMLDialogElement) {
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}
</script>

<dialog {@attach sync} aria-labelledby="{id}-title" onclose={() => (open = false)}>
	<h2 id="{id}-title">{title}</h2>
	{@render children()}
</dialog>

<style>
	dialog {
		width: min(32rem, 100% - 2rem);
		padding: 1.5rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-m);
		background: var(--surface);
		color: var(--text);
		overscroll-behavior: contain;
	}

	dialog::backdrop {
		background: color-mix(in oklab, var(--bg) 70%, transparent);
		backdrop-filter: blur(2px);
	}

	h2 {
		font-size: var(--step-2);
		margin-bottom: 1.25rem;
	}

	dialog :global(form) {
		display: grid;
		gap: 1rem;
	}

	dialog :global(.actions) {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
</style>

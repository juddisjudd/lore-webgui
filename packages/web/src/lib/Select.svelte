<script lang="ts" generics="T extends string">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';

	interface Option {
		readonly value: T;
		readonly label: string;
	}

	let {
		value = $bindable(),
		options,
		label,
		onchange,
		disabled = false,
		mono = false,
		wide = false,
		icon
	}: {
		value: T;
		options: ReadonlyArray<Option>;
		label: string;
		onchange?: (value: T) => void;
		disabled?: boolean;
		mono?: boolean;
		wide?: boolean;
		icon?: Snippet;
	} = $props();

	const id = $props.id();
	const GAP = 4;

	let trigger: HTMLButtonElement;
	let list: HTMLUListElement;
	let open = $state(false);
	let active = $state(0);
	let typed = '';
	let typedAt = 0;

	const selectedIndex = $derived(Math.max(0, options.findIndex((option) => option.value === value)));
	const selected = $derived(options[selectedIndex]);
	const longest = $derived(options.reduce((a, b) => (b.label.length > a.length ? b.label : a), ''));

	function place() {
		const rect = trigger.getBoundingClientRect();
		const below = innerHeight - rect.bottom;
		list.style.minWidth = `${rect.width}px`;
		list.style.left = `${Math.min(rect.left, innerWidth - rect.width - GAP)}px`;
		if (below < 180 && rect.top > below) {
			list.style.top = 'auto';
			list.style.bottom = `${innerHeight - rect.top + GAP}px`;
			list.style.maxHeight = `${Math.min(320, rect.top - GAP * 2)}px`;
		} else {
			list.style.bottom = 'auto';
			list.style.top = `${rect.bottom + GAP}px`;
			list.style.maxHeight = `${Math.min(320, below - GAP * 2)}px`;
		}
	}

	async function reveal(index: number) {
		active = Math.max(0, Math.min(options.length - 1, index));
		await tick();
		list.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
	}

	function show(index = selectedIndex) {
		if (disabled || options.length === 0) return;
		if (!open) list.showPopover();
		void reveal(index);
	}

	function hide() {
		if (open) list.hidePopover();
	}

	function commit(index: number) {
		const option = options[index];
		hide();
		trigger.focus();
		if (option && option.value !== value) {
			value = option.value;
			onchange?.(option.value);
		}
	}

	function find(key: string) {
		const now = Date.now();
		typed = now - typedAt > 700 ? key : typed + key;
		typedAt = now;
		const start = typed.length === 1 ? active + 1 : active;
		const ordered = [...options.slice(start), ...options.slice(0, start)];
		const match = ordered.find((option) => option.label.toLowerCase().startsWith(typed.toLowerCase()));
		return match ? options.indexOf(match) : -1;
	}

	function keydown(event: KeyboardEvent) {
		const last = options.length - 1;
		const move = (index: number) => {
			event.preventDefault();
			show(index);
		};
		switch (event.key) {
			case 'ArrowDown':
				return move(open ? active + 1 : selectedIndex);
			case 'ArrowUp':
				return move(open ? active - 1 : selectedIndex);
			case 'Home':
				return move(0);
			case 'End':
				return move(last);
			case 'PageDown':
				return open ? move(active + 8) : undefined;
			case 'PageUp':
				return open ? move(active - 8) : undefined;
			case 'Enter':
			case ' ':
				event.preventDefault();
				return open ? commit(active) : show();
			case 'Tab':
				if (open) commit(active);
				return;
		}
		if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
			const index = find(event.key);
			if (index >= 0) move(index);
		}
	}
</script>

<svelte:window onresize={hide} onscroll={hide} />

<button
	bind:this={trigger}
	type="button"
	role="combobox"
	class={['trigger', mono && 'mono', wide && 'wide']}
	aria-label={label}
	aria-haspopup="listbox"
	aria-expanded={open}
	aria-controls="{id}-list"
	aria-activedescendant={open ? `${id}-option-${active}` : undefined}
	popovertarget="{id}-list"
	{disabled}
	onkeydown={keydown}
>
	{@render icon?.()}
	<span class="value" translate={mono ? 'no' : undefined}>
		<span>{selected?.label ?? ''}</span>
		<span class="sizer" aria-hidden="true">{longest}</span>
	</span>
	<svg class="chevron" viewBox="0 0 7 7" width="10" height="10" aria-hidden="true">
		<path d="M1 2h1v1h1v1h1V3h1V2h1v1H5v1H4v1H3V4H2V3H1z" />
	</svg>
</button>

<ul
	bind:this={list}
	id="{id}-list"
	role="listbox"
	aria-label={label}
	popover="auto"
	class={[mono && 'mono']}
	onbeforetoggle={(event) => {
		if (event.newState === 'open') {
			place();
			active = selectedIndex;
		}
	}}
	ontoggle={(event) => (open = event.newState === 'open')}
>
	{#each options as option, index (option.value)}
		<li
			id="{id}-option-{index}"
			role="option"
			tabindex="-1"
			data-index={index}
			aria-selected={option.value === value}
			class={{ active: index === active }}
			onpointermove={() => (active = index)}
			onclick={() => commit(index)}
			onkeydown={keydown}
		>
			<span>{option.label}</span>
			{#if option.value === value}
				<svg viewBox="0 0 7 7" width="10" height="10" aria-hidden="true"><path d="M5 1h1v2H5v1H4v1H3v1H2V5H1V3h1v1h1V3h1V2h1z" /></svg>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: var(--select-height, 2.4rem);
		max-width: var(--select-max-width, 22rem);
		padding: 0 0.7rem;
		border: 1px solid var(--line-strong);
		background: var(--bg);
		color: var(--text);
		cursor: pointer;
		text-align: left;
	}

	.trigger.wide {
		display: flex;
		width: 100%;
		max-width: none;
	}

	.trigger:hover:not(:disabled) {
		border-color: var(--muted);
	}

	.trigger:disabled {
		color: var(--muted);
		cursor: not-allowed;
	}

	.trigger[aria-expanded='true'] {
		border-color: var(--muted);
	}

	.value {
		flex: 1;
		display: grid;
		min-width: 0;
	}

	.value > span {
		grid-area: 1 / 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sizer {
		visibility: hidden;
	}

	.chevron {
		flex: none;
		fill: currentColor;
		color: var(--muted);
		shape-rendering: crispEdges;
	}

	.trigger[aria-expanded='true'] .chevron {
		transform: rotate(180deg);
	}

	ul {
		position: fixed;
		inset: auto;
		margin: 0;
		padding: 0.25rem 0;
		max-width: min(28rem, 100vw - 1rem);
		overflow-y: auto;
		list-style: none;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		color: var(--text);
	}

	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.4rem 0.7rem;
		cursor: pointer;
		white-space: nowrap;
	}

	li.active {
		background: var(--text);
		color: var(--bg);
	}

	li svg {
		flex: none;
		fill: currentColor;
		shape-rendering: crispEdges;
	}

	li:focus {
		outline: none;
	}
</style>

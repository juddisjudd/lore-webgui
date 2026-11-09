<script lang="ts">
	import type { User } from '@lore-webui/api';
	import { tick } from 'svelte';

	let { user, onsignout }: { user: User; onsignout: () => void } = $props();

	const id = $props.id();
	const roles = { admin: 'Admin', member: 'Member', viewer: 'Viewer' } as const;

	let trigger: HTMLButtonElement;
	let menu: HTMLDivElement;
	let open = $state(false);

	const items = () => [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];

	async function focusItem(index: number) {
		await tick();
		const list = items();
		list[(index + list.length) % list.length]?.focus();
	}

	function place() {
		const rect = trigger.getBoundingClientRect();
		menu.style.top = `${rect.bottom + 6}px`;
		menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;
	}

	function close() {
		if (open) menu.hidePopover();
	}

	function triggerKeydown(event: KeyboardEvent) {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		if (!open) menu.showPopover();
		void focusItem(event.key === 'ArrowDown' ? 0 : -1);
	}

	function menuKeydown(event: KeyboardEvent) {
		const list = items();
		const current = list.indexOf(document.activeElement as HTMLElement);
		const moves: Record<string, number> = {
			ArrowDown: current + 1,
			ArrowUp: current - 1,
			Home: 0,
			End: list.length - 1
		};
		if (event.key in moves) {
			event.preventDefault();
			void focusItem(moves[event.key]!);
		} else if (event.key === 'Tab') {
			close();
		}
	}
</script>

<svelte:window onresize={close} />

<button
	bind:this={trigger}
	type="button"
	class="trigger"
	aria-haspopup="menu"
	aria-expanded={open}
	aria-controls="{id}-menu"
	popovertarget="{id}-menu"
	onkeydown={triggerKeydown}
>
	<span class="mono" translate="no">{user.username}</span>
	<svg viewBox="0 0 7 7" width="10" height="10" aria-hidden="true">
		<path d="M1 2h1v1h1v1h1V3h1V2h1v1H5v1H4v1H3V4H2V3H1z" />
	</svg>
</button>

<div
	bind:this={menu}
	id="{id}-menu"
	role="menu"
	aria-label="Account"
	popover="auto"
	tabindex="-1"
	onkeydown={menuKeydown}
	onbeforetoggle={(event) => {
		if (event.newState === 'open') place();
	}}
	ontoggle={(event) => {
		open = event.newState === 'open';
		if (open && document.activeElement === trigger) void focusItem(0);
		else if (!open && menu.contains(document.activeElement)) trigger.focus();
	}}
>
	<p class="who" role="presentation">
		<span class="mono" translate="no">{user.username}</span>
		<span class="muted">{roles[user.role]}</span>
	</p>
	<a role="menuitem" href="/settings" onclick={close}>Settings</a>
	{#if user.role === 'admin' && !user.mustChangePassword}
		<a role="menuitem" href="/users" onclick={close}>Users</a>
	{/if}
	<hr />
	<button
		role="menuitem"
		type="button"
		onclick={() => {
			close();
			onsignout();
		}}>Sign out</button
	>
</div>

<style>
	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.35rem 0.5rem;
		border: 0;
		background: none;
		color: var(--muted);
	}

	.trigger:hover,
	.trigger[aria-expanded='true'] {
		color: var(--text);
	}

	.trigger svg {
		fill: currentColor;
		shape-rendering: crispEdges;
	}

	.trigger[aria-expanded='true'] svg {
		transform: rotate(180deg);
	}

	[role='menu'] {
		position: fixed;
		inset: auto;
		min-width: 12rem;
		margin: 0;
		padding: 0.25rem 0;
		border: 1px solid var(--line-strong);
		background: var(--surface);
		color: var(--text);
		font-size: var(--step--1);
	}

	.who {
		display: grid;
		padding: 0.5rem 0.85rem 0.6rem;
		border-bottom: 1px solid var(--line);
		margin-bottom: 0.25rem;
	}

	[role='menuitem'] {
		display: block;
		width: 100%;
		padding: 0.45rem 0.85rem;
		border: 0;
		background: none;
		text-align: left;
		text-decoration: none;
	}

	[role='menuitem']:hover {
		background: var(--text);
		color: var(--bg);
	}

	[role='menuitem']:focus-visible {
		outline: none;
	}

	hr {
		margin: 0.25rem 0;
		border: 0;
		border-top: 1px solid var(--line);
	}
</style>

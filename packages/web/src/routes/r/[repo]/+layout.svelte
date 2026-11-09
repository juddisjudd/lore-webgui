<script lang="ts">
	import { goto, refreshAll } from '$app/navigation';
	import { page } from '$app/state';
	import Composition from '#lib/Composition.svelte';
	import Select from '#lib/Select.svelte';
	import { withRef } from '#lib/links.ts';
	import { watchRepository } from '#lib/live.ts';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const base = $derived(`/r/${data.repo.id}`);
	const branchQuery = $derived(data.branch.name === data.repo.defaultBranchName ? null : data.branch.name);

	const tabs = $derived([
		{ key: '1', label: 'Files', href: withRef(`${base}/files`, { branch: branchQuery, rev: data.rev }), match: [`${base}/files`] },
		{ key: '2', label: 'History', href: withRef(`${base}/history`, { branch: branchQuery }), match: [`${base}/history`, `${base}/rev`] },
		{ key: '3', label: 'Branches', href: `${base}/branches`, match: [`${base}/branches`, `${base}/compare`] },
		{
			key: '4',
			label: 'Locks',
			href: withRef(`${base}/locks`, { branch: branchQuery }),
			match: [`${base}/locks`],
			count: data.locks.ok ? data.locks.value.length : 0
		}
	]);

	const branchOptions = $derived(
		data.branches.filter((b) => !b.deleted).map((b) => ({ value: b.name, label: b.name }))
	);

	const section = $derived(page.url.pathname.split('/')[3] ?? 'files');

	const repoId = $derived(data.repo.id);
	let visible = $state(document.visibilityState === 'visible');
	let connectedBefore = false;
	let pending: ReturnType<typeof setTimeout> | undefined;

	function refreshSoon() {
		clearTimeout(pending);
		pending = setTimeout(() => void refreshAll(), 300);
	}

	$effect(() => {
		if (!visible) return;
		const stop = watchRepository(repoId, {
			onOpen: () => {
				if (connectedBefore) refreshSoon();
				connectedBefore = true;
			},
			onEvent: refreshSoon
		});
		return () => {
			clearTimeout(pending);
			stop();
		};
	});

	function switchBranch(name: string) {
		const target = section === 'history' || section === 'locks' ? section : 'files';
		const branch = name === data.repo.defaultBranchName ? null : name;
		void goto(withRef(`${base}/${target}`, { branch }));
	}

	function shortcut(event: KeyboardEvent) {
		if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('input, textarea, select, [contenteditable], [role="combobox"]') || document.querySelector('dialog[open]')) return;
		const tab = tabs.find((t) => t.key === event.key);
		if (!tab) return;
		event.preventDefault();
		void goto(tab.href);
	}
</script>

<svelte:window onkeydown={shortcut} />
<svelte:document onvisibilitychange={() => (visible = document.visibilityState === 'visible')} />

<svelte:head>
	<title>{data.repo.name} – Lore</title>
</svelte:head>

<header class="repo">
	<div class="title">
		<h1 translate="no"><a href={base}>{data.repo.name}</a></h1>
		{#if data.repo.description}
			<p class="muted">{data.repo.description}</p>
		{/if}
	</div>
	<Composition repo={data.repo.id} branch={data.branch.id} signature={data.branch.latest} />
	<div class="controls">
		<div class="picker">
			<Select label="Branch" mono value={data.branch.name} options={branchOptions} onchange={switchBranch}>
				{#snippet icon()}
					<svg class="branch-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
						<path
							d="M5 2.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 3v5m0 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6-8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm0 3c0 2.5-6 2-6 5"
							fill="none"
							stroke="currentColor"
							stroke-width="1.3"
						/>
					</svg>
				{/snippet}
			</Select>
		</div>
		<nav class="tabs" aria-label="Repository">
			{#each tabs as tab (tab.label)}
				<a
					href={tab.href}
					aria-keyshortcuts={tab.key}
					aria-current={tab.match.some((m) => page.url.pathname.startsWith(m)) ? 'page' : undefined}
				>
					<kbd aria-hidden="true">{tab.key}</kbd>
					<span>{tab.label}</span>
					{#if tab.count}<span class="count">{tab.count}</span>{/if}
				</a>
			{/each}
		</nav>
	</div>
</header>

{@render children()}

<style>
	.repo {
		display: grid;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.title {
		display: grid;
		gap: 0.5rem;
	}

	h1 {
		font-size: var(--step-3);
		overflow-wrap: anywhere;
	}

	h1 a {
		text-decoration: none;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: end;
		gap: 1rem 2.5rem;
		border-bottom: 1px solid var(--line);
	}

	.picker {
		margin-bottom: 0.6rem;
		--select-height: 2.1rem;
	}

	.branch-icon {
		flex: none;
		color: var(--muted);
	}

	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0 1.75rem;
	}

	@media (max-width: 40rem) {
		.tabs {
			gap: 0 1.25rem;
		}

		.tabs kbd {
			display: none;
		}
	}

	.tabs a {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0 0.75rem;
		text-decoration: none;
		color: var(--muted);
		font-family: var(--font-mono);
		font-weight: 600;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.tabs a:hover {
		color: var(--text);
	}

	.tabs a[aria-current='page'] {
		color: var(--text);
		border-bottom-color: var(--text);
	}

	.count {
		margin-left: -0.15rem;
		color: var(--muted);
		font-weight: 400;
		font-variant-numeric: tabular-nums;
	}

	.tabs a[aria-current='page'] kbd {
		border-color: var(--text);
		background: var(--text);
		color: var(--bg);
	}
</style>

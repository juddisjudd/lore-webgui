<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	const host = $derived(data.server.grpcUrl.replace(/^\w+:\/\//, ''));
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<a class="skip" href="#main">Skip to content</a>

<div class="app">
	<header class="bar">
		<nav class="inner" aria-label="Main">
			<a class="wordmark" href="/">
				<svg viewBox="0 0 7 7" width="21" height="21" aria-hidden="true">
					<rect width="7" height="7" class="mark-ground" />
					<path d="M1 1h1v4h4v1H1zM4 1h2v2H4z" class="mark-ink" />
				</svg>
				<span>lore</span>
			</a>
			<span class={['server', data.server.reachable ? 'up' : 'down']} title={data.server.error ?? host}>
				<span class="dot" aria-hidden="true"></span>
				<span class="host" translate="no">{host}</span>
				<span class="visually-hidden">{data.server.reachable ? 'connected' : 'unreachable'}</span>
			</span>
		</nav>
	</header>

	{#if !data.server.reachable}
		<div class="outage" role="alert">
			<div class="inner">
				<strong>Lore server unreachable.</strong>
				<span>{data.server.error}</span>
			</div>
		</div>
	{/if}

	<main id="main" class="inner" tabindex="-1">
		{@render children()}
	</main>

	<footer class="foot">
		<div class="inner">
			<span class="versions" translate="no">
				<span>lore web ui <span class="version">{__APP_VERSION__}</span></span>
				{#if data.server.reachable && data.server.version}
					<span>lore server <span class="version">{data.server.version}</span></span>
				{/if}
			</span>
			<nav aria-label="Resources">
				<a href="/api/docs" data-sveltekit-reload>API docs</a>
				<a href="https://epicgames.github.io/lore/" rel="external">Lore docs</a>
				<a href="https://github.com/juddisjudd/lore-webgui" rel="external">Source on GitHub</a>
			</nav>
		</div>
	</footer>
</div>

<style>
	.inner {
		width: var(--page);
		margin-inline: auto;
	}

	.bar {
		border-bottom: 1px solid var(--line);
	}

	.bar nav {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		min-height: 3.5rem;
	}

	.wordmark {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		font-family: var(--font-mono);
		font-size: var(--step-1);
		font-weight: 700;
		letter-spacing: -0.03em;
		text-decoration: none;
	}

	.mark-ground {
		fill: var(--text);
	}

	.mark-ink {
		fill: var(--bg);
	}

	.server {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--step--1);
		min-width: 0;
	}

	.host {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dot {
		width: 0.45rem;
		height: 0.45rem;
		flex: none;
	}

	.up .dot {
		background: var(--add);
	}

	.down .dot {
		background: var(--del);
	}

	.outage {
		background: var(--del-wash);
		padding-block: 0.6rem;
		font-size: var(--step--1);
	}

	.outage .inner {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.app {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
	}

	main {
		flex: 1;
		padding-block: 2.5rem 5rem;
		outline: none;
	}

	.foot {
		border-top: 1px solid var(--line);
		padding-block: 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
		font-family: var(--font-mono);
		font-size: var(--step--1);
		color: var(--muted);
	}

	.foot .inner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 2rem;
	}

	.versions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
	}

	.version {
		color: var(--text);
	}

	.foot nav {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.5rem;
	}

	.foot a {
		text-decoration: none;
	}

	.foot a:hover {
		color: var(--text);
		text-decoration: underline;
	}

	.skip {
		position: absolute;
		left: 1rem;
		top: -3rem;
		padding: 0.5rem 0.75rem;
		background: var(--text);
		color: var(--bg);
		z-index: 10;
	}

	.skip:focus-visible {
		top: 0.5rem;
	}
</style>

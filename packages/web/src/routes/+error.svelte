<script lang="ts">
	import { page } from '$app/state';
</script>

<section>
	<h1>{page.status === 404 ? 'Not found' : 'Something went wrong'}</h1>
	<p>{page.error?.message}</p>
	<p><a href="/">Back to repositories</a></p>
</section>

<style>
	section {
		display: grid;
		gap: 0.75rem;
		max-width: 60ch;
		padding-block: 2rem;
	}

	h1 {
		font-size: var(--step-3);
	}
</style>

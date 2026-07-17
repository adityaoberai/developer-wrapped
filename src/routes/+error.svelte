<script lang="ts">
	import { page } from '$app/state';
	import Seo from '$lib/components/Seo.svelte';
	import TeaserRow from '$lib/components/TeaserRow.svelte';

	const notFound = $derived(page.status === 404);
</script>

<Seo
	title="{page.status === 404 ? 'Page not found' : 'Something broke'} | Developer Wrapped"
	description="This page took a wrong turn. Head back to Developer Wrapped and find out what kind of developer you really are."
	noindex
/>

<main id="main-content" class="screen shell" tabindex="-1">
	<div class="content fade-up">
		<p class="code"><span class="sr-only">Error </span>{page.status}</p>
		{#if notFound}
			<h1>This page shipped straight to /dev/null</h1>
			<p class="muted">
				Either the link is wrong, the result went private, or a Production Cowboy deleted it on a
				Friday.
			</p>
		{:else}
			<h1>Something broke (it wasn't you)</h1>
			<p class="muted">{page.error?.message ?? 'An unexpected error occurred.'}</p>
		{/if}
		<a class="btn" href="/">Return home</a>
		<div class="teaser">
			<p class="muted teaser-label">Meanwhile, meet the archetypes:</p>
			<TeaserRow />
		</div>
	</div>
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		padding-block: 2rem;
	}

	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		width: 100%;
		text-align: center;
	}

	.code {
		font-size: 4.5rem;
		font-weight: 900;
		line-height: 1;
		background: linear-gradient(100deg, var(--accent-bright), #f0abfc);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	h1 {
		font-size: clamp(1.5rem, 6vw, 2.125rem);
		font-weight: 800;
	}

	.teaser {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.teaser-label {
		font-size: 0.875rem;
	}
</style>

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
		<p class="eyebrow">Developer Wrapped</p>

		<div class="code-frame">
			<span class="code-cap">HTTP status</span>
			<p class="code"><span class="sr-only">Error </span>{page.status}</p>
			<span class="stamp-mark code-stamp" aria-hidden="true"
				>{notFound ? 'Not found' : 'Server error'}</span
			>
		</div>

		<div class="source-stamp source-line" aria-hidden="true">
			<span class="tag">SOURCE</span>
			<span class="val">http_status=<b>{page.status}</b></span>
		</div>

		{#if notFound}
			<h1>This page shipped straight to /dev/null</h1>
			<p class="muted body">
				Either the link is wrong, the result went private, or a Production Cowboy deleted it on a
				Friday.
			</p>
		{:else}
			<h1>Something broke (it wasn't you)</h1>
			<p class="muted body">{page.error?.message ?? 'An unexpected error occurred.'}</p>
		{/if}

		<a class="btn" href="/">Return home</a>

		<hr class="perf teaser-sep" />

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
		gap: 1.25rem;
		width: 100%;
		text-align: center;
	}

	/* The status code, printed as an exit code: mono, tabular, framed in
	   ink like the mockup's bignum-frame, with a rubber-stamp verdict. */
	.code-frame {
		position: relative;
		width: 100%;
		margin-top: 0.4rem;
		padding: 1.9rem 1rem 1.4rem;
		border: 1.5px solid var(--ink);
		border-radius: var(--radius-md);
		background: linear-gradient(0deg, rgba(27, 23, 18, 0.03), transparent 42%);
	}

	.code-cap {
		position: absolute;
		top: -0.55rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0 0.625rem;
		background: var(--paper);
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
	}

	.code {
		font-family: var(--mono);
		font-size: clamp(3.75rem, 20vw, 6rem);
		font-weight: 700;
		line-height: 0.9;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}

	.code-stamp {
		position: absolute;
		top: -0.85rem;
		right: 0.55rem;
		animation: stamp-in 420ms ease both;
	}

	.source-line {
		width: 100%;
	}

	h1 {
		font-size: clamp(1.5rem, 6vw, 2.125rem);
		margin-top: 0.25rem;
	}

	/* Long-form copy stays Inter and measure-limited for readability. */
	.body {
		max-width: 34ch;
	}

	.teaser-sep {
		width: 100%;
		margin-top: 0.75rem;
	}

	.teaser {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}

	.teaser-label {
		font-size: 0.8125rem;
	}
</style>

<script lang="ts">
	import GithubButton from '$lib/components/GithubButton.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import TeaserRow from '$lib/components/TeaserRow.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Seo
	title="Developer Wrapped — What kind of developer are you, really?"
	description="Your last 12 months on GitHub, turned into an uncomfortably accurate story. Sign in with GitHub, see the evidence, get roasted, share the damage."
/>

<main id="main-content" class="screen shell" tabindex="-1">
	<header class="hero fade-up">
		<p class="eyebrow">Developer Wrapped</p>
		<h1>What kind of developer are you, <em>really?</em></h1>
		<p class="sub muted">
			Your last 12 months on GitHub, turned into a story with receipts — plus eight uncomfortably
			accurate questions, if you dare.
		</p>
	</header>

	<div class="cta fade-up">
		{#if data.signedIn}
			<a class="btn" href="/welcome">Continue as {data.name || 'you'}</a>
		{:else}
			<GithubButton />
		{/if}
		<div class="links">
			<a href="/archetypes">Browse the archetypes</a>
			<span aria-hidden="true">·</span>
			<a href="/feed">Recently Wrapped</a>
		</div>
	</div>

	<section class="teaser-block fade-up" aria-label="Possible results">
		<h2 class="sr-only">Possible results</h2>
		<TeaserRow />
	</section>

	<footer class="trust muted">
		<p>
			Powered by <a href="https://appwrite.io" rel="noreferrer">Appwrite</a> Auth, Databases &
			Realtime. Signing in asks GitHub for read-only profile access (<code>read:user</code>). We
			store your public profile and aggregate contribution counts for the exact period shown — never
			your code, repository contents, or tokens. Everything stays private until you explicitly
			publish it, and published pages show only the stats you chose to share.
		</p>
	</footer>
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2rem;
		padding-block: 3rem 2rem;
		text-align: center;
	}

	.hero h1 {
		font-size: clamp(2.25rem, 9vw, 3.25rem);
		font-weight: 900;
		margin-top: 0.75rem;
	}

	.hero em {
		font-style: normal;
		background: linear-gradient(100deg, var(--accent-bright), #f0abfc);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.sub {
		margin-top: 1rem;
		font-size: 1.0625rem;
	}

	.cta {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.links {
		display: flex;
		justify-content: center;
		gap: 0.625rem;
		font-size: 0.9375rem;
	}

	.links a {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
	}

	.trust {
		font-size: 0.8125rem;
		max-width: 26rem;
		margin-inline: auto;
	}

	.trust a {
		color: inherit;
	}

	@media (min-width: 48rem) {
		.screen {
			gap: 2.5rem;
		}
	}
</style>

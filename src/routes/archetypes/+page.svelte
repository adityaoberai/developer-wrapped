<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
	import { archetypes } from '$lib/content/archetypes';
</script>

<Seo
	title="The eight archetypes | Developer Wrapped"
	description="Meet all eight developer archetypes: from the Production Cowboy to the Vibe Coder. Which one are you?"
/>

<main id="main-content" class="shell shell--wide page" tabindex="-1">
	<nav class="mini-nav">
		<a href="/" class="home-link">← Developer Wrapped</a>
	</nav>

	<header class="head">
		<h1>The eight archetypes</h1>
		<p class="muted">Every developer is one of these. Most are two. All of them are in denial.</p>
	</header>

	<ul class="grid">
		{#each archetypes as archetype (archetype.id)}
			<li
				class="card archetype fade-up"
				style:--card-a={archetype.gradient[0]}
				style:--card-b={archetype.gradient[1]}
			>
				<span class="emoji" aria-hidden="true">{archetype.emoji}</span>
				<h2>{archetype.name}</h2>
				<p class="tagline">“{archetype.tagline}”</p>
				<ul class="traits">
					{#each archetype.traits as trait (trait)}
						<li>{trait}</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ul>

	<footer class="cta">
		<a class="btn" href="/">Find out which one you are</a>
	</footer>
</main>

<style>
	.page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding-block: 1rem 2.5rem;
	}

	.mini-nav {
		padding-block: 0.5rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 700;
		font-size: 0.9375rem;
		color: var(--muted);
		text-decoration: none;
	}

	.home-link:hover {
		color: var(--fg);
	}

	.head h1 {
		font-size: clamp(1.875rem, 7vw, 2.75rem);
		font-weight: 900;
		margin-bottom: 0.5rem;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		list-style: none;
		padding: 0;
	}

	.archetype {
		background:
			radial-gradient(
				22rem 14rem at 90% -20%,
				color-mix(in srgb, var(--card-a) 40%, transparent),
				transparent 65%
			),
			var(--bg-raised);
	}

	.emoji {
		font-size: 2.25rem;
	}

	.archetype h2 {
		font-size: 1.5rem;
		font-weight: 900;
		margin-top: 0.5rem;
	}

	.tagline {
		margin-top: 0.375rem;
		font-weight: 600;
		color: #cbd5e1;
	}

	.traits {
		margin-top: 0.875rem;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		font-size: 0.875rem;
		color: var(--muted);
	}

	.traits li::before {
		content: '▸ ';
		color: var(--accent-bright);
	}

	.cta {
		margin-top: auto;
		padding-top: 1rem;
	}

	@media (min-width: 40rem) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>

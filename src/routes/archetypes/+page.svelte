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
		<div class="docket">
			<span>Case files</span>
			<span>Reg 04 · Exhibits 01–08</span>
		</div>
		<p class="eyebrow">Filed under archetypes</p>
		<h1>The eight archetypes</h1>
		<p class="lede muted">
			Every developer is one of these. Most are two. All of them are in denial.
		</p>
		<hr class="perf" />
	</header>

	<ul class="grid">
		{#each archetypes as archetype, i (archetype.id)}
			<li
				class="card archetype fade-up"
				style:--accent={archetype.gradient[0]}
				style:--accent-ink={`color-mix(in srgb, ${archetype.gradient[0]} 65%, var(--ink))`}
				style:animation-delay={`${i * 70}ms`}
			>
				<div class="ex-head">
					<span class="folio">Exhibit {(i + 1).toString().padStart(2, '0')}</span>
					<span class="stamp-mark">Filed</span>
				</div>

				<span class="emoji" aria-hidden="true">{archetype.emoji}</span>
				<h2>{archetype.name}</h2>
				<p class="tagline">“{archetype.tagline}”</p>

				<hr class="rule-line" />

				<ul class="traits">
					{#each archetype.traits as trait (trait)}
						<li>{trait}</li>
					{/each}
				</ul>

				<div class="source-stamp">
					<span class="tag">SOURCE</span>
					<span class="val">archetype=<b>{archetype.id}</b></span>
				</div>
			</li>
		{/each}
	</ul>

	<footer class="cta">
		<hr class="perf" />
		<a class="btn" href="/">Find out which one you are</a>
		<p class="footnote">Eight exhibits · <span>zero mercy</span> · GitHub has testified</p>
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
		gap: 0.5ch;
		min-height: 2.75rem;
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		text-decoration: none;
	}

	.home-link:hover {
		color: var(--ink);
	}

	/* Masthead — a filing docket for the exhibit gallery. */
	.docket {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
		background: var(--ink);
		color: var(--receipt);
		padding: 0.5rem 0.875rem;
		margin-bottom: 0.875rem;
		border-radius: var(--radius-sm);
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.head h1 {
		font-size: clamp(1.875rem, 7vw, 2.75rem);
		letter-spacing: -0.02em;
		margin: 0.5rem 0;
	}

	.lede {
		max-width: 44ch;
	}

	.head .perf {
		margin-top: 1.25rem;
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1rem;
		list-style: none;
		padding: 0;
	}

	/* Each card is an exhibit receipt, themed by its own --accent. */
	.archetype {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.125rem 1.25rem 1.25rem;
		border-color: var(--rule);
		border-top: 3px solid var(--accent);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.archetype:hover {
		transform: translate(-1px, -1px);
		box-shadow: 6px 7px 0 rgba(27, 23, 18, 0.14);
	}

	.ex-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.folio {
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--muted);
		display: inline-flex;
		align-items: center;
		gap: 0.6ch;
	}

	.folio::before {
		content: '›';
		color: var(--accent);
		font-weight: 700;
	}

	.emoji {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 3.25rem;
		height: 3.25rem;
		font-size: 1.875rem;
		line-height: 1;
		border: 1.5px solid var(--accent);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--accent) 8%, var(--receipt));
		box-shadow: inset 0 0 0 1px var(--stamp-band);
	}

	.archetype h2 {
		font-size: 1.375rem;
		line-height: 1.1;
	}

	.tagline {
		font-family: var(--sans);
		font-size: 0.9375rem;
		font-style: italic;
		color: var(--ink-2);
		text-wrap: pretty;
	}

	.traits {
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.4375rem;
		font-family: var(--mono);
		font-size: 0.8125rem;
		color: var(--ink-2);
	}

	.traits li {
		display: flex;
		gap: 0.6ch;
	}

	.traits li::before {
		content: '▸';
		color: var(--accent);
		font-weight: 700;
		flex: 0 0 auto;
	}

	.source-stamp {
		margin-top: 0.125rem;
	}

	.cta {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-top: 0.5rem;
	}

	.footnote {
		text-align: center;
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.footnote span {
		color: var(--stamp-ink);
	}

	@media (min-width: 40rem) {
		.grid {
			grid-template-columns: 1fr 1fr;
		}
	}
</style>

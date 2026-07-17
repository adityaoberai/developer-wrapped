<script lang="ts">
	import { page } from '$app/state';
	import Seo from '$lib/components/Seo.svelte';
	import { getArchetype } from '$lib/content/archetypes';
	import { periodLabel } from '$lib/wrapped/story';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const share = $derived(data.share);
	const archetype = $derived(share.archetype_id ? getArchetype(share.archetype_id) : null);
	const quizArchetype = $derived(
		share.quiz_archetype_id ? getArchetype(share.quiz_archetype_id) : null
	);
	const name = $derived(share.display_name || share.github_username || 'A developer');

	let copied = $state(false);
	let canNativeShare = $state(false);

	onMount(() => {
		canNativeShare = typeof navigator.share === 'function';
	});

	const shareUrl = $derived(`${page.url.origin}/w/${share.share_slug}`);
	const shareText = $derived(
		`${name} made ${share.metrics.contributions.toLocaleString('en-US')} contributions on GitHub (${periodLabel(share.period_start, share.period_end)}) | Developer Wrapped`
	);

	function fmt(n: number): string {
		return n.toLocaleString('en-US');
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
		}
	}

	async function nativeShare() {
		try {
			await navigator.share({ title: 'Developer Wrapped', text: shareText, url: shareUrl });
		} catch {
			// user dismissed the sheet — nothing to do
		}
	}
</script>

<Seo
	title="{name}'s Developer Wrapped"
	description="{fmt(share.metrics.contributions)} contributions across {fmt(
		share.metrics.activeDays
	)} active days ({periodLabel(share.period_start, share.period_end)})."
	image="/og?wrapped={share.share_slug}"
/>

<main
	id="main-content"
	class="screen shell"
	tabindex="-1"
	style:--tint-a={archetype?.gradient[0] ?? '#7C3AED'}
	style:--tint-b={archetype?.gradient[1] ?? '#DB2777'}
>
	<nav class="mini-nav">
		<a href="/" class="home-link">Developer Wrapped</a>
	</nav>

	<article class="wrap-card" aria-labelledby="wrap-heading">
		<header class="who">
			{#if share.avatar_url}
				<img src={share.avatar_url} alt="" width="48" height="48" referrerpolicy="no-referrer" />
			{/if}
			<div>
				<p class="name">{name}</p>
				{#if share.github_username}
					<p class="handle">@{share.github_username}</p>
				{/if}
			</div>
			<span class="period">{periodLabel(share.period_start, share.period_end)}</span>
		</header>

		<div class="headline">
			<p class="big-number">{fmt(share.metrics.contributions)}</p>
			<h1 id="wrap-heading">contributions this year</h1>
		</div>

		<dl class="stats">
			<div>
				<dt>Active days</dt>
				<dd>{fmt(share.metrics.activeDays)}</dd>
			</div>
			<div>
				<dt>Pull requests</dt>
				<dd>{fmt(share.metrics.pullRequests)}</dd>
			</div>
			<div>
				<dt>Reviews</dt>
				<dd>{fmt(share.metrics.reviews)}</dd>
			</div>
			<div>
				<dt>Issues</dt>
				<dd>{fmt(share.metrics.issues)}</dd>
			</div>
			<div>
				<dt>Longest streak</dt>
				<dd>{fmt(share.metrics.longestStreak)} days</dd>
			</div>
			{#if share.metrics.busiestMonthLabel}
				<div>
					<dt>Busiest month</dt>
					<dd>{share.metrics.busiestMonthLabel}</dd>
				</div>
			{/if}
		</dl>

		{#if share.metrics.topLanguages.length > 0}
			<p class="langs muted">
				Speaks {share.metrics.topLanguages.join(', ')} (publicly, at least).
			</p>
		{/if}

		{#if archetype}
			<footer class="verdict">
				<span aria-hidden="true">{archetype.emoji}</span>
				GitHub says: <strong>{archetype.name}</strong>
				{#if quizArchetype && quizArchetype.id !== archetype.id}
					· they claimed {quizArchetype.name} {quizArchetype.emoji}
				{:else if quizArchetype}
					· the quiz agrees
				{/if}
			</footer>
		{/if}
	</article>

	<section class="actions" aria-label="Share actions">
		<button class="btn" type="button" onclick={copyLink}>
			{copied ? 'Link copied! 🎉' : 'Copy link'}
		</button>
		{#if canNativeShare}
			<button class="btn btn--ghost" type="button" onclick={nativeShare}>Share…</button>
		{/if}
		<a class="btn btn--ghost" href="/">Get your own Wrapped</a>
	</section>

	<p class="footnote muted">
		Published {new Date(share.published_at).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		})} · stats cover exactly {periodLabel(share.period_start, share.period_end)} · stored with
		<a href="https://appwrite.io" rel="noreferrer">Appwrite</a> · see who else got wrapped on the
		<a href="/feed">live feed</a>.
	</p>
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-block: 1rem 2.5rem;
	}

	.mini-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-block: 0.5rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 800;
		font-size: 0.9375rem;
		letter-spacing: 0.02em;
		color: var(--fg);
		text-decoration: none;
	}

	.wrap-card {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-dim);
		padding: 1.375rem;
		background:
			radial-gradient(
				30rem 20rem at 85% -15%,
				color-mix(in srgb, var(--tint-a) 55%, transparent),
				transparent 65%
			),
			radial-gradient(
				24rem 18rem at -10% 110%,
				color-mix(in srgb, var(--tint-b) 40%, transparent),
				transparent 60%
			),
			var(--bg-raised);
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.who > div {
		flex: 1;
		min-width: 0;
	}

	.who img {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: 2px solid rgba(248, 250, 252, 0.55);
	}

	.name,
	.handle {
		overflow-wrap: anywhere;
	}

	.name {
		font-weight: 700;
		line-height: 1.2;
	}

	.handle {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.period {
		margin-left: auto;
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.04em;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.headline {
		text-align: center;
		padding-block: 0.5rem;
	}

	.big-number {
		font-size: clamp(3rem, 16vw, 5rem);
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.03em;
		background: linear-gradient(100deg, var(--tint-a), var(--tint-b));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.headline h1 {
		font-size: 1.125rem;
		font-weight: 700;
		color: var(--muted);
		margin-top: 0.375rem;
	}

	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
		margin: 0;
	}

	.stats div {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		padding: 0.625rem 0.875rem;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid var(--border-dim);
	}

	.stats dt {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--muted);
	}

	.stats dd {
		margin: 0;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.langs {
		font-size: 0.9rem;
		text-align: center;
	}

	.verdict {
		font-size: 0.9rem;
		color: var(--muted);
		font-weight: 600;
		text-align: center;
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.footnote {
		text-align: center;
		font-size: 0.8125rem;
	}

	.footnote a {
		color: inherit;
	}
</style>

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
	style:--accent={archetype?.gradient[0] ?? '#b23016'}
	style:--accent-ink="color-mix(in srgb, {archetype?.gradient[0] ?? '#b23016'} 65%, var(--ink))"
>
	<nav class="statusbar">
		<a href="/" class="home-link">Developer Wrapped<span class="caret" aria-hidden="true"></span></a
		>
		<span class="status-meta" aria-hidden="true">REC ● SHARE-READY</span>
	</nav>

	<article class="wrap-card fade-up" aria-labelledby="wrap-heading">
		<div class="ticket-head">
			<p class="eyebrow">Developer Wrapped</p>
			<span class="stamp-mark" aria-hidden="true">Certified true copy</span>
		</div>

		<hr class="perf" />

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

		<hr class="rule-line" />

		<div class="headline">
			<span class="cap" aria-hidden="true">365-day total</span>
			<p class="big-number">{fmt(share.metrics.contributions)}</p>
			<h1 id="wrap-heading">contributions this year</h1>
		</div>

		<div class="source-stamp">
			<span class="tag">SOURCE</span>
			<span class="val"
				>contributions=<b>{fmt(share.metrics.contributions)}</b> · active_days=<b
					>{fmt(share.metrics.activeDays)}</b
				></span
			>
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
				<span class="verdict-emoji" aria-hidden="true">{archetype.emoji}</span>
				<span class="verdict-text">
					GitHub says: <strong>{archetype.name}</strong>
					{#if quizArchetype && quizArchetype.id !== archetype.id}
						<span class="claimed">· they claimed {quizArchetype.name} {quizArchetype.emoji}</span>
					{:else if quizArchetype}
						<span class="agrees">· the quiz agrees</span>
					{/if}
				</span>
			</footer>

			<div class="source-stamp">
				<span class="tag">SOURCE</span>
				<span class="val">archetype=<b>{archetype.id}</b></span>
			</div>
		{/if}

		<hr class="rule-line" />

		<div class="barcode-row">
			<div class="cap">
				<span>No returns · no refunds</span>
				<span class="id">{share.share_slug}</span>
			</div>
			<div class="barcode" aria-hidden="true"></div>
		</div>
	</article>

	<div class="tear" aria-hidden="true"></div>

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

	/* Status bar — the receipt folio / merchant header. */
	.statusbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-block: 0.5rem 0.75rem;
		border-bottom: 2px dashed var(--rule);
		font-family: var(--mono);
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.9375rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink);
		text-decoration: none;
	}

	.status-meta {
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* The share card as a ticket stub: receipt stock, hard ink border,
	   die-cut notches mid-height on each side. */
	.wrap-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
		padding: 1.375rem 1.25rem 1.5rem;
		background: var(--receipt);
		border: 1.5px solid var(--ink);
		border-radius: var(--radius-lg);
		--notch: 12px;
		-webkit-mask:
			radial-gradient(
				circle at left center,
				transparent var(--notch),
				#000 calc(var(--notch) + 0.5px)
			),
			radial-gradient(
				circle at right center,
				transparent var(--notch),
				#000 calc(var(--notch) + 0.5px)
			);
		-webkit-mask-composite: source-in;
		mask:
			radial-gradient(
				circle at left center,
				transparent var(--notch),
				#000 calc(var(--notch) + 0.5px)
			),
			radial-gradient(
				circle at right center,
				transparent var(--notch),
				#000 calc(var(--notch) + 0.5px)
			);
		mask-composite: intersect;
	}

	.ticket-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.stamp-mark {
		animation: stamp-in 400ms ease both;
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
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		background: var(--receipt);
		border: 2px solid var(--ink);
		box-shadow:
			0 0 0 2px var(--receipt),
			0 0 0 3.5px var(--ink);
	}

	.name,
	.handle {
		overflow-wrap: anywhere;
	}

	.name {
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.9375rem;
		letter-spacing: 0.02em;
		line-height: 1.2;
	}

	.handle {
		font-family: var(--mono);
		font-size: 0.8125rem;
		color: var(--muted);
	}

	.period {
		margin-left: auto;
		align-self: flex-start;
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	/* Big-number frame — solid ink/accent digits, no gradient clip. */
	.headline {
		position: relative;
		text-align: center;
		padding: 1.5rem 0.75rem 1rem;
		border: 1.5px solid var(--ink);
		background: linear-gradient(0deg, rgba(27, 23, 18, 0.03), transparent 42%);
	}

	.headline .cap {
		position: absolute;
		top: -0.5rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0 0.625rem;
		background: var(--receipt);
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
	}

	.big-number {
		font-family: var(--mono);
		font-size: clamp(2.75rem, 15vw, 4.25rem);
		font-weight: 700;
		line-height: 0.92;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
		color: var(--accent-ink);
	}

	.headline h1 {
		margin-top: 0.625rem;
		font-size: 0.8125rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--muted);
	}

	/* Stat ledger grid — hairline rules via a 1px gap over an ink frame. */
	.stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1px;
		margin: 0;
		background: var(--rule-2);
		border: 1px solid var(--ink);
	}

	.stats > div {
		display: flex;
		flex-direction: column-reverse;
		gap: 0.2rem;
		padding: 0.7rem 0.85rem;
		background: var(--receipt);
	}

	.stats > div:last-child:nth-child(odd) {
		grid-column: 1 / -1;
	}

	.stats dt {
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.stats dd {
		margin: 0;
		font-family: var(--mono);
		font-size: 1.375rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.01em;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	/* Long-form reading stays in the sans register. */
	.langs {
		font-size: 0.9375rem;
		line-height: 1.5;
		text-align: center;
	}

	.verdict {
		display: flex;
		align-items: baseline;
		gap: 0.6rem;
		padding: 0.75rem 0.85rem;
		border: 1px solid var(--rule);
		border-left: 3px solid var(--accent);
		background: var(--band);
	}

	.verdict-emoji {
		flex: 0 0 auto;
		font-size: 1.5rem;
		line-height: 1;
	}

	.verdict-text {
		font-family: var(--sans);
		font-size: 0.9375rem;
		line-height: 1.5;
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	.verdict-text strong {
		color: var(--accent-ink);
		font-weight: 700;
	}

	.claimed {
		color: var(--pen);
		font-weight: 700;
		text-decoration: line-through;
		text-decoration-color: rgba(39, 75, 122, 0.55);
	}

	.agrees {
		color: var(--muted);
	}

	.barcode-row {
		margin-top: 0.25rem;
	}

	.barcode-row .cap {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.4rem;
		font-family: var(--mono);
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.barcode-row .cap .id {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	/* "Tear here" perforation between the stub and the share controls. */
	.tear {
		position: relative;
		height: 0;
		margin: 0.25rem 0;
		border-top: 2px dashed var(--rule);
	}

	.tear::after {
		content: '✂ TEAR HERE';
		position: absolute;
		top: -0.5rem;
		right: 1rem;
		padding: 0 0.375rem;
		background: var(--paper);
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.18em;
		color: var(--muted);
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.footnote {
		text-align: center;
		font-size: 0.8125rem;
		line-height: 1.6;
		color: var(--muted);
	}

	.footnote a {
		color: var(--accent-ink);
		text-underline-offset: 0.18em;
	}
</style>

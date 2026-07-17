<script lang="ts">
	import { page } from '$app/state';
	import Seo from '$lib/components/Seo.svelte';
	import { getArchetype } from '$lib/content/archetypes';
	import { CARD_FORMATS, renderWrappedCard, shareCardFile, type CardFormat } from '$lib/share-card';
	import { headlineMetric } from '$lib/wrapped/metrics';
	import { deriveGithubArchetype, periodLabel, pickObservation } from '$lib/wrapped/story';
	import type { WrappedReportDto } from '$lib/wrapped/types';
	import { onMount, tick } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The report is fetched once on load and replaced wholesale after a sync or
	// publish; slides derive everything from it.
	// svelte-ignore state_referenced_locally
	let report = $state<WrappedReportDto | null>(data.report);
	// svelte-ignore state_referenced_locally
	let syncing = $state(!data.report);
	let syncError = $state('');
	let needsReconnect = $state(false);

	const metrics = $derived(report?.metrics ?? null);
	const verdict = $derived(metrics ? deriveGithubArchetype(metrics) : null);
	const observation = $derived(metrics ? pickObservation(metrics) : null);
	const githubArchetype = $derived(verdict ? getArchetype(verdict.archetypeId) : null);
	const quizArchetype = $derived(data.quizArchetypeId ? getArchetype(data.quizArchetypeId) : null);
	const agreement = $derived(
		quizArchetype && verdict ? quizArchetype.id === verdict.archetypeId : null
	);

	const TOTAL_SLIDES = 8;
	let slide = $state(0);

	const slideTitles = [
		'Your Developer Wrapped',
		'The volume',
		'The rhythm',
		'The collaboration',
		'The territory',
		'The observation',
		'You said vs. GitHub says',
		'The verdict'
	] as const;

	function fmt(n: number): string {
		return n.toLocaleString('en-US');
	}

	async function sync() {
		syncing = true;
		syncError = '';
		needsReconnect = false;
		try {
			const res = await fetch('/api/wrapped', { method: 'POST' });
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { message?: string } | null;
				needsReconnect = res.status === 409;
				syncError = body?.message ?? 'Something went wrong collecting your GitHub data.';
				return;
			}
			report = ((await res.json()) as { report: WrappedReportDto }).report;
			slide = 0;
		} catch {
			syncError = 'Something went wrong collecting your GitHub data.';
		} finally {
			syncing = false;
		}
	}

	// Signing in triggers the github-wrapped Appwrite Function, so a missing
	// report usually means that background sync is still mid-flight. Poll for
	// its result briefly before falling back to collecting inline. The signal
	// ties the loop to the component: navigating away mid-poll must not leave
	// a stray inline sync running.
	const POLL_INTERVAL_MS = 2000;
	const POLL_ATTEMPTS = 5;

	async function waitForBackgroundSync(signal: AbortSignal) {
		syncing = true;
		syncError = '';
		needsReconnect = false;
		for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
			try {
				const res = await fetch('/api/wrapped', { signal });
				if (res.ok) {
					const payload = (await res.json()) as {
						report: WrappedReportDto | null;
						canSync?: boolean;
					};
					if (payload.report) {
						report = payload.report;
						slide = 0;
						syncing = false;
						return;
					}
					if (payload.canSync === false) {
						// No GitHub token on file — the background sync can never land,
						// so show the reconnect prompt instead of polling out the clock.
						needsReconnect = true;
						syncError = 'GitHub authorization is missing or expired — sign in with GitHub again.';
						syncing = false;
						return;
					}
				}
			} catch {
				// transient (or aborted) — the checks below decide what happens next
			}
			if (signal.aborted) return;
			if (attempt < POLL_ATTEMPTS - 1) {
				await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
				if (signal.aborted) return;
			}
		}
		await sync();
	}

	onMount(() => {
		if (report) return;
		const controller = new AbortController();
		void waitForBackgroundSync(controller.signal);
		return () => controller.abort();
	});

	function next() {
		if (slide < TOTAL_SLIDES - 1) slide += 1;
	}
	function prev() {
		if (slide > 0) slide -= 1;
	}
	function skipToEnd() {
		slide = TOTAL_SLIDES - 1;
	}

	function onKeydown(event: KeyboardEvent) {
		if (!report || syncing) return;
		const target = event.target as HTMLElement | null;
		if (target && ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
			if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		}
		if (event.key === 'ArrowRight' || event.key === ' ') {
			event.preventDefault();
			next();
		} else if (event.key === 'ArrowLeft') {
			event.preventDefault();
			prev();
		} else if (event.key === 'End') {
			event.preventDefault();
			skipToEnd();
		}
	}

	$effect(() => {
		void slide;
		tick().then(() => document.getElementById('slide-heading')?.focus());
	});

	// --- publishing ---
	let publishBusy = $state(false);
	let publishError = $state(false);
	let unpublishBusy = $state(false);
	let copied = $state(false);
	let actionStatus = $state('');

	const shareUrl = $derived(
		report?.share_slug ? `${page.url.origin}/w/${report.share_slug}` : null
	);

	async function publish() {
		if (!report) return;
		publishBusy = true;
		publishError = false;
		actionStatus = 'Publishing your Wrapped.';
		try {
			const res = await fetch('/api/wrapped/publish', { method: 'POST' });
			if (!res.ok) throw new Error(`publish failed (${res.status})`);
			const { share } = (await res.json()) as { share: { share_slug: string } };
			report = { ...report, is_published: true, share_slug: share.share_slug };
			actionStatus = 'Your Wrapped is published.';
		} catch {
			publishError = true;
			actionStatus = '';
		} finally {
			publishBusy = false;
		}
	}

	async function unpublish() {
		if (!report) return;
		unpublishBusy = true;
		publishError = false;
		actionStatus = 'Unpublishing your Wrapped.';
		try {
			const res = await fetch('/api/wrapped/publish', { method: 'DELETE' });
			if (!res.ok) throw new Error(`unpublish failed (${res.status})`);
			report = { ...report, is_published: false, share_slug: null };
			actionStatus = 'Your Wrapped is private again. The old link no longer works.';
		} catch {
			publishError = true;
			actionStatus = '';
		} finally {
			unpublishBusy = false;
		}
	}

	async function copyLink() {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			actionStatus = 'Share link copied to the clipboard.';
			setTimeout(() => (copied = false), 2000);
		} catch {
			actionStatus = 'Could not copy — copy the link from the address bar instead.';
		}
	}

	// --- share cards ---
	let cardFormat = $state<CardFormat>('story');
	let cardBusy = $state(false);
	let cardError = $state(false);
	let canNativeShare = $state(false);

	onMount(() => {
		canNativeShare = typeof navigator.share === 'function';
	});

	function cardInput() {
		if (!metrics || !githubArchetype) return null;
		return {
			displayName: data.profile?.display_name ?? '',
			githubUsername: data.profile?.github_username ?? '',
			avatarUrl: data.profile?.avatar_url ?? '',
			periodLabel: periodLabel(metrics.period.start, metrics.period.end),
			headline: headlineMetric(metrics),
			stats: [
				{ value: fmt(metrics.totals.contributions), label: 'contributions' },
				{ value: fmt(metrics.activeDays), label: 'active days' },
				{ value: fmt(metrics.totals.pullRequests), label: 'pull requests' },
				{ value: fmt(metrics.longestStreak?.days ?? 0), label: 'longest streak (days)' }
			],
			archetypeName: githubArchetype.name,
			archetypeEmoji: githubArchetype.emoji,
			gradient: githubArchetype.gradient,
			brandUrl: page.url.host
		};
	}

	async function downloadCard() {
		const input = cardInput();
		if (!input) return;
		cardBusy = true;
		cardError = false;
		actionStatus = 'Rendering the share card.';
		try {
			const blob = await renderWrappedCard(input, cardFormat);
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `developer-wrapped-${cardFormat}.png`;
			link.click();
			URL.revokeObjectURL(link.href);
			actionStatus = 'Share card downloaded.';
		} catch {
			cardError = true;
			actionStatus = '';
		} finally {
			cardBusy = false;
		}
	}

	async function shareCard() {
		const input = cardInput();
		if (!input) return;
		cardBusy = true;
		cardError = false;
		try {
			const blob = await renderWrappedCard(input, cardFormat);
			const text = shareUrl ? `My Developer Wrapped: ${shareUrl}` : 'My Developer Wrapped';
			const shared = await shareCardFile(blob, `developer-wrapped-${cardFormat}.png`, text);
			if (!shared && shareUrl) {
				await navigator.share({ title: 'Developer Wrapped', text, url: shareUrl });
			}
		} catch {
			// user dismissed the sheet — nothing to do
		} finally {
			cardBusy = false;
		}
	}
</script>

<Seo
	title="Your Wrapped — Developer Wrapped"
	description="A private, evidence-backed story about your last 12 months on GitHub."
	noindex
/>

<svelte:window onkeydown={onKeydown} />

<div
	class="deck"
	style:--tint-a={githubArchetype?.gradient[0] ?? '#7C3AED'}
	style:--tint-b={githubArchetype?.gradient[1] ?? '#DB2777'}
>
	{#if syncing}
		<main id="main-content" class="loading shell" tabindex="-1" role="status" aria-live="polite">
			<div class="orb" aria-hidden="true"></div>
			<h1 class="pulse">Interviewing your commits…</h1>
			<p class="muted">
				Collecting 12 months of aggregate contribution data from GitHub. Counts only — never your
				code.
			</p>
		</main>
	{:else if !report}
		<main id="main-content" class="loading shell" tabindex="-1">
			<span class="big-emoji" aria-hidden="true">📡</span>
			<h1>Couldn't gather the evidence</h1>
			<p class="muted" role="alert">{syncError}</p>
			{#if needsReconnect}
				<a class="btn" href="/auth/login">Reconnect GitHub</a>
			{:else}
				<button class="btn" type="button" onclick={sync}>Try again</button>
			{/if}
			<a class="btn btn--ghost" href="/welcome">Back to start</a>
		</main>
	{:else if metrics}
		<header class="deck-top">
			<div class="deck-top-inner shell">
				<div
					class="segments"
					role="progressbar"
					aria-label="Story progress"
					aria-valuemin={1}
					aria-valuemax={TOTAL_SLIDES}
					aria-valuenow={slide + 1}
					aria-valuetext="Slide {slide + 1} of {TOTAL_SLIDES}: {slideTitles[slide]}"
				>
					{#each slideTitles as title, i (title)}
						<span class="segment" class:done={i <= slide}></span>
					{/each}
				</div>
				{#if slide < TOTAL_SLIDES - 1}
					<button class="skip" type="button" onclick={skipToEnd}>Skip</button>
				{/if}
			</div>
		</header>

		<main id="main-content" class="stage shell" tabindex="-1">
			{#key slide}
				<section class="slide fade-up" aria-labelledby="slide-heading">
					{#if slide === 0}
						<p class="eyebrow">Developer Wrapped</p>
						<h1 id="slide-heading" tabindex="-1">Your year, with receipts.</h1>
						<p class="hero-line">{periodLabel(metrics.period.start, metrics.period.end)}</p>
						<p class="muted">
							{metrics.period.days} days of aggregate GitHub activity, synced
							{new Date(report.synced_at).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})}.
							{#if metrics.coverage === 'partial'}
								Your GitHub account is younger than the window, so we counted from day one.
							{/if}
						</p>
						<p class="source">source: period={metrics.period.key}, coverage={metrics.coverage}</p>
					{:else if slide === 1}
						<p class="eyebrow">The volume</p>
						<p class="big-number">{fmt(metrics.totals.contributions)}</p>
						<h1 id="slide-heading" tabindex="-1">contributions in {metrics.period.days} days</h1>
						<p class="hero-line">
							You showed up on <strong>{fmt(metrics.activeDays)}</strong> of them.
						</p>
						{#if metrics.totals.restricted > 0}
							<p class="muted">
								Plus {fmt(metrics.totals.restricted)} private contributions we counted but will never
								itemize.
							</p>
						{/if}
						<p class="source">
							source: total_contributions={metrics.totals.contributions}, active_days={metrics.activeDays}
						</p>
					{:else if slide === 2}
						<p class="eyebrow">The rhythm</p>
						<h1 id="slide-heading" tabindex="-1">When you actually work</h1>
						<dl class="facts">
							{#if metrics.busiestMonth}
								<div>
									<dt>Busiest month</dt>
									<dd>{metrics.busiestMonth.label} · {fmt(metrics.busiestMonth.contributions)}</dd>
								</div>
							{/if}
							{#if metrics.busiestWeekday}
								<div>
									<dt>Busiest weekday</dt>
									<dd>
										{metrics.busiestWeekday.name} · {fmt(metrics.busiestWeekday.contributions)}
									</dd>
								</div>
							{/if}
							{#if metrics.longestStreak}
								<div>
									<dt>Longest streak</dt>
									<dd>{metrics.longestStreak.days} days</dd>
								</div>
							{/if}
							{#if metrics.peakDay}
								<div>
									<dt>Peak day</dt>
									<dd>{metrics.peakDay.date} · {fmt(metrics.peakDay.contributions)}</dd>
								</div>
							{/if}
							{#if !metrics.busiestMonth}
								<div>
									<dt>Activity</dt>
									<dd>A perfectly blank calendar. Zen.</dd>
								</div>
							{/if}
						</dl>
						<p class="source">source: busiest_month, busiest_weekday, longest_streak, peak_day</p>
					{:else if slide === 3}
						<p class="eyebrow">The collaboration</p>
						<h1 id="slide-heading" tabindex="-1">Playing with others</h1>
						<dl class="facts">
							<div>
								<dt>Pull requests</dt>
								<dd>{fmt(metrics.totals.pullRequests)}</dd>
							</div>
							<div>
								<dt>Reviews given</dt>
								<dd>{fmt(metrics.totals.reviews)}</dd>
							</div>
							<div>
								<dt>Issues filed</dt>
								<dd>{fmt(metrics.totals.issues)}</dd>
							</div>
							<div>
								<dt>Commits</dt>
								<dd>{fmt(metrics.totals.commits)}</dd>
							</div>
						</dl>
						<p class="source">
							source: pull_requests={metrics.totals.pullRequests}, reviews={metrics.totals.reviews},
							issues={metrics.totals.issues}, commits={metrics.totals.commits}
						</p>
					{:else if slide === 4}
						<p class="eyebrow">The territory</p>
						<h1 id="slide-heading" tabindex="-1">
							{fmt(metrics.repositories.contributedTo)} repositories felt your presence
						</h1>
						{#if metrics.languages.length > 0}
							<ul class="langs">
								{#each metrics.languages.slice(0, 5) as lang (lang.name)}
									<li>
										<span class="lang-name">{lang.name}</span>
										<span class="lang-bar" aria-hidden="true">
											<span class="lang-fill" style:width="{Math.round(lang.share * 100)}%"></span>
										</span>
										<span class="lang-share">{Math.round(lang.share * 100)}%</span>
									</li>
								{/each}
							</ul>
							<p class="muted">
								Public repositories only — private ones stay uncounted and unnamed.
							</p>
						{:else}
							<p class="hero-line">No public language data this year. A ghost. Respect.</p>
						{/if}
						<p class="source">
							source: repositories_contributed_to={metrics.repositories.contributedTo},
							public_language_mix
						</p>
					{:else if slide === 5}
						<p class="eyebrow">The observation</p>
						<span class="big-emoji" aria-hidden="true">🔎</span>
						<h1 id="slide-heading" tabindex="-1">We noticed something.</h1>
						{#if observation}
							<p class="hero-line">{observation.text}</p>
							<p class="source">source: {observation.source}</p>
						{/if}
					{:else if slide === 6}
						<p class="eyebrow">You said vs. GitHub says</p>
						{#if quizArchetype && githubArchetype}
							<h1 id="slide-heading" tabindex="-1">The confrontation</h1>
							<div class="versus">
								<div class="versus-side">
									<p class="versus-label">You said</p>
									<span class="versus-emoji" aria-hidden="true">{quizArchetype.emoji}</span>
									<p class="versus-name">{quizArchetype.name}</p>
								</div>
								<span class="versus-vs" aria-hidden="true">vs</span>
								<div class="versus-side">
									<p class="versus-label">GitHub says</p>
									<span class="versus-emoji" aria-hidden="true">{githubArchetype.emoji}</span>
									<p class="versus-name">{githubArchetype.name}</p>
								</div>
							</div>
							<p class="hero-line">
								{agreement
									? 'Complete agreement. Suspicious, but the data checks out.'
									: 'The quiz caught your self-image. The commit log caught you.'}
							</p>
							{#if verdict}
								<p class="source">source: {verdict.reason.source}</p>
							{/if}
						{:else}
							<h1 id="slide-heading" tabindex="-1">One side of this story is missing</h1>
							<p class="hero-line">
								GitHub has testified. Want to see if your self-image agrees? The quiz takes two
								minutes and is only slightly judgmental.
							</p>
							<a class="btn btn--subtle quiz-cta" href="/quiz">Take the quiz</a>
						{/if}
					{:else if slide === 7}
						<p class="eyebrow">The verdict</p>
						{#if githubArchetype && verdict}
							<span class="big-emoji" aria-hidden="true">{githubArchetype.emoji}</span>
							<h1 id="slide-heading" tabindex="-1">
								GitHub says: {githubArchetype.name}
							</h1>
							<p class="hero-line">{verdict.reason.text}</p>
							<p class="source">source: {verdict.reason.source}</p>
						{/if}

						<div class="publish" aria-label="Sharing controls">
							<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
								{actionStatus}
							</p>
							{#if !report.is_published}
								<div class="publish-box">
									<p class="publish-title">Your Wrapped is private</p>
									<p class="publish-copy muted">
										Publishing creates a public link showing your name, avatar, the reporting
										period, and these stats: contributions, active days, pull requests, reviews,
										issues, longest streak, busiest month, and top languages. Nothing else — and you
										can unpublish at any time.
									</p>
									<button
										class="btn"
										type="button"
										onclick={publish}
										disabled={publishBusy}
										aria-busy={publishBusy}
									>
										{publishBusy ? 'Publishing…' : 'Publish my Wrapped'}
									</button>
								</div>
							{:else}
								<div class="publish-box">
									<p class="publish-title">Published 🎉</p>
									{#if shareUrl}
										<p class="share-url">{shareUrl}</p>
									{/if}
									<button class="btn" type="button" onclick={copyLink}>
										{copied ? 'Link copied! 🎉' : 'Copy share link'}
									</button>
									<button
										class="btn btn--ghost"
										type="button"
										onclick={unpublish}
										disabled={unpublishBusy}
										aria-busy={unpublishBusy}
									>
										{unpublishBusy ? 'Unpublishing…' : 'Unpublish (link stops working)'}
									</button>
								</div>
							{/if}
							{#if publishError}
								<p class="card-error" role="alert">That didn't go through — try again.</p>
							{/if}

							<div class="card-controls">
								<div class="formats" role="radiogroup" aria-label="Share card format">
									{#each CARD_FORMATS as format (format.id)}
										<button
											class="format"
											class:active={cardFormat === format.id}
											type="button"
											role="radio"
											aria-checked={cardFormat === format.id}
											onclick={() => (cardFormat = format.id)}
										>
											{format.label} · {format.ratio}
										</button>
									{/each}
								</div>
								<button
									class="btn btn--subtle"
									type="button"
									onclick={downloadCard}
									disabled={cardBusy}
									aria-busy={cardBusy}
								>
									{cardBusy ? 'Rendering card…' : 'Download share card'}
								</button>
								{#if canNativeShare}
									<button
										class="btn btn--ghost"
										type="button"
										onclick={shareCard}
										disabled={cardBusy}
									>
										Share…
									</button>
								{/if}
								{#if cardError}
									<p class="card-error" role="alert">Couldn't render the card — try again.</p>
								{/if}
							</div>

							<button class="resync" type="button" onclick={sync}>Refresh GitHub data</button>
						</div>
					{/if}
				</section>
			{/key}
		</main>

		<footer class="deck-nav">
			<div class="deck-nav-inner shell">
				<button class="nav-btn" type="button" onclick={prev} disabled={slide === 0}>
					← Back
				</button>
				<span class="counter" aria-hidden="true">{slide + 1}/{TOTAL_SLIDES}</span>
				<button
					class="nav-btn nav-btn--primary"
					type="button"
					onclick={next}
					disabled={slide === TOTAL_SLIDES - 1}
				>
					Next →
				</button>
			</div>
		</footer>
	{/if}
</div>

<style>
	.deck {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background:
			radial-gradient(
				60rem 40rem at 50% -20%,
				color-mix(in srgb, var(--tint-a) 22%, transparent),
				transparent 70%
			),
			radial-gradient(
				50rem 36rem at 50% 120%,
				color-mix(in srgb, var(--tint-b) 16%, transparent),
				transparent 70%
			),
			var(--bg);
	}

	.loading {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-align: center;
		padding-block: 3rem;
	}

	.orb {
		width: 5.5rem;
		height: 5.5rem;
		border-radius: 50%;
		background: conic-gradient(from 0deg, var(--tint-a), var(--tint-b), var(--tint-a));
		animation:
			spin 1.4s linear infinite,
			pulse-soft 1.4s ease-in-out infinite;
		filter: blur(1px);
	}

	.pulse {
		animation: pulse-soft 1.6s ease-in-out infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.deck-top {
		position: sticky;
		top: 0;
		z-index: 10;
		padding-top: env(safe-area-inset-top);
	}

	.deck-top-inner {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding-block: 0.875rem;
	}

	.segments {
		flex: 1;
		display: flex;
		gap: 0.375rem;
	}

	.segment {
		flex: 1;
		height: 0.375rem;
		border-radius: 999px;
		background: rgba(226, 232, 240, 0.18);
	}

	.segment.done {
		background: linear-gradient(90deg, var(--accent-bright), #f0abfc);
	}

	.skip {
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.875rem;
		font-weight: 700;
		cursor: pointer;
		min-height: 2.75rem;
		padding-inline: 0.5rem;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-block: 1.5rem;
	}

	.slide {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
	}

	.slide h1 {
		font-size: clamp(1.625rem, 7vw, 2.5rem);
		font-weight: 900;
	}

	.slide h1:focus {
		outline: none;
	}

	.hero-line {
		font-size: 1.125rem;
		line-height: 1.55;
		max-width: 26rem;
	}

	.big-number {
		font-size: clamp(3.5rem, 18vw, 6rem);
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.03em;
		background: linear-gradient(100deg, var(--tint-a), var(--tint-b));
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.big-emoji {
		font-size: 4rem;
		line-height: 1;
	}

	.source {
		margin-top: 0.5rem;
		font-size: 0.75rem;
		font-family: ui-monospace, 'Cascadia Code', 'SF Mono', monospace;
		color: color-mix(in srgb, var(--muted) 75%, transparent);
		overflow-wrap: anywhere;
	}

	.facts {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		width: 100%;
		margin: 0.5rem 0 0;
	}

	.facts div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-dim);
		background: color-mix(in srgb, var(--bg-raised) 82%, transparent);
	}

	.facts dt {
		font-size: 0.875rem;
		font-weight: 700;
		color: var(--muted);
		text-align: left;
	}

	.facts dd {
		margin: 0;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		text-align: right;
		overflow-wrap: anywhere;
	}

	.langs {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		width: 100%;
		list-style: none;
		padding: 0;
		margin-top: 0.5rem;
	}

	.langs li {
		display: grid;
		grid-template-columns: minmax(5.5rem, auto) 1fr 3rem;
		align-items: center;
		gap: 0.75rem;
	}

	.lang-name {
		font-size: 0.875rem;
		font-weight: 700;
		text-align: left;
		overflow-wrap: anywhere;
	}

	.lang-bar {
		height: 0.5rem;
		border-radius: 999px;
		background: rgba(226, 232, 240, 0.14);
		overflow: hidden;
	}

	.lang-fill {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--tint-a), var(--tint-b));
	}

	.lang-share {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.versus {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		width: 100%;
		margin-top: 0.5rem;
	}

	.versus-side {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		padding: 1rem 0.75rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-dim);
		background: color-mix(in srgb, var(--bg-raised) 82%, transparent);
		min-width: 0;
	}

	.versus-label {
		font-size: 0.75rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: var(--muted);
	}

	.versus-emoji {
		font-size: 2.25rem;
		line-height: 1;
	}

	.versus-name {
		font-weight: 800;
		font-size: 0.9375rem;
		overflow-wrap: anywhere;
	}

	.versus-vs {
		font-weight: 900;
		color: var(--muted);
	}

	.quiz-cta {
		margin-top: 0.5rem;
	}

	.publish {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		width: 100%;
		margin-top: 1rem;
	}

	.publish-box {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.125rem;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, var(--bg-raised));
		text-align: left;
	}

	.publish-title {
		font-weight: 800;
	}

	.publish-copy {
		font-size: 0.9075rem;
		line-height: 1.5;
	}

	.share-url {
		font-size: 0.875rem;
		font-family: ui-monospace, 'Cascadia Code', 'SF Mono', monospace;
		overflow-wrap: anywhere;
		color: var(--accent-bright);
	}

	.card-controls {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.formats {
		display: flex;
		gap: 0.5rem;
	}

	.format {
		flex: 1;
		min-height: 2.75rem;
		padding: 0.5rem 0.625rem;
		border-radius: var(--radius-md);
		border: 1.5px solid var(--border-dim);
		background: var(--bg-raised);
		color: var(--fg);
		font-size: 0.8125rem;
		font-weight: 700;
		cursor: pointer;
	}

	.format.active {
		border-color: var(--accent-bright);
		background: color-mix(in srgb, var(--accent) 28%, var(--bg-raised));
	}

	.card-error {
		font-size: 0.875rem;
		color: var(--warn);
	}

	.resync {
		align-self: center;
		border: 0;
		background: none;
		color: var(--muted);
		font: inherit;
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 0.2em;
		min-height: 2.75rem;
	}

	.deck-nav {
		position: sticky;
		bottom: 0;
		padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		backdrop-filter: blur(8px);
	}

	.deck-nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 0.625rem;
	}

	.nav-btn {
		min-height: 2.75rem;
		padding: 0.5rem 1rem;
		border-radius: var(--radius-md);
		border: 1.5px solid var(--border-dim);
		background: var(--bg-raised);
		color: var(--fg);
		font: inherit;
		font-weight: 700;
		font-size: 0.9375rem;
		cursor: pointer;
	}

	.nav-btn--primary {
		background: var(--accent);
		border-color: transparent;
	}

	.nav-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.counter {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		font-size: 0.875rem;
		color: var(--muted);
	}
</style>

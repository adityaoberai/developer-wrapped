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
						syncError = 'GitHub authorization is missing or expired. Sign in with GitHub again.';
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
		// The share modal owns the keyboard while open — don't advance the deck behind it.
		if (!report || syncing || shareOpen) return;
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
			actionStatus = 'Could not copy. Copy the link from the address bar instead.';
		}
	}

	// --- share cards ---
	let cardFormat = $state<CardFormat>('story');
	let cardBusy = $state(false);
	let cardError = $state(false);
	let canNativeShare = $state(false);
	let cardPreviewUrl = $state<string | null>(null);
	// The format that produced the displayed image — the preview box tracks
	// this, not the live selection, so the frame never mismatches its picture
	// while a re-render is in flight.
	let previewFormat = $state<CardFormat | null>(null);
	let previewPending = $state(false);
	// Monotonic token: only the latest render may publish its object URL, so a
	// slow story render can't overwrite a newer square one.
	let previewToken = 0;

	// The share-card image lives in a focused modal opened from the verdict slide.
	let shareOpen = $state(false);
	let shareDialog = $state<HTMLDialogElement | null>(null);

	function openShare() {
		shareOpen = true;
		if (shareDialog && !shareDialog.open) shareDialog.showModal();
	}
	function closeShare() {
		shareDialog?.close();
	}
	function backdropClose(event: MouseEvent) {
		// A click that lands on the <dialog> element itself is the backdrop.
		if (event.target === shareDialog) closeShare();
	}

	onMount(() => {
		canNativeShare = typeof navigator.share === 'function';
		return () => {
			previewToken += 1;
			if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
		};
	});

	const PREVIEW_RATIOS: Record<CardFormat, string> = {
		story: '9 / 16',
		portrait: '4 / 5',
		square: '1 / 1'
	};
	const previewShownFormat = $derived(previewFormat ?? cardFormat);

	// Live preview of the exact PNG the download/share buttons produce,
	// re-rendered whenever the share modal is open and the format, metrics, or
	// quiz result changes.
	$effect(() => {
		const format = cardFormat;
		const input = metrics && githubArchetype ? cardInput() : null;
		// Only render the (potentially heavy) canvas while the share modal is open.
		if (!shareOpen || !input) return;
		const token = ++previewToken;
		previewPending = true;
		void renderWrappedCard(input, format)
			.then((blob) => {
				if (token !== previewToken) return;
				if (cardPreviewUrl) URL.revokeObjectURL(cardPreviewUrl);
				cardPreviewUrl = URL.createObjectURL(blob);
				previewFormat = format;
				previewPending = false;
			})
			.catch(() => {
				// Preview is best-effort; download/share surface real errors.
				if (token === previewToken) previewPending = false;
			});
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
			// The quiz self-assessment turns the card's verdict line into the
			// full "you said vs. GitHub says" confrontation when available.
			quizArchetypeName: quizArchetype?.name,
			quizArchetypeEmoji: quizArchetype?.emoji,
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
	title="Your Wrapped | Developer Wrapped"
	description="A private, evidence-backed story about your last 12 months on GitHub."
	noindex
/>

<svelte:window onkeydown={onKeydown} />

<div
	class="deck"
	style:--accent={githubArchetype?.gradient[0] ?? 'var(--stamp)'}
	style:--accent-ink={githubArchetype
		? `color-mix(in srgb, ${githubArchetype.gradient[0]} 65%, var(--ink))`
		: 'var(--stamp-ink)'}
>
	{#if syncing}
		<main id="main-content" class="loading shell" tabindex="-1" role="status" aria-live="polite">
			<div class="printer" aria-hidden="true">
				<div class="printer-slot"></div>
				<div class="printer-sheet">
					<span class="printer-line"></span>
					<span class="printer-line"></span>
					<span class="printer-line"></span>
					<span class="printer-line"></span>
				</div>
			</div>
			<p class="eyebrow load-eyebrow">Now printing</p>
			<h1 class="pulse">
				Interviewing your commits…<span class="caret" aria-hidden="true"></span>
			</h1>
			<p class="muted">
				Collecting 12 months of aggregate contribution data from GitHub. Counts only, never your
				code.
			</p>
		</main>
	{:else if !report}
		<main id="main-content" class="loading shell error-state" tabindex="-1">
			<span class="stamp-mark error-stamp" aria-hidden="true">Void · No Record</span>
			<p class="eyebrow">Signal lost</p>
			<span class="big-emoji" aria-hidden="true">📡</span>
			<h1>Couldn't gather the evidence</h1>
			<p class="muted" role="alert">{syncError}</p>
			<div class="error-actions">
				{#if needsReconnect}
					<a class="btn" href="/auth/login">Reconnect GitHub</a>
				{:else}
					<button class="btn" type="button" onclick={sync}>Try again</button>
				{/if}
				<a class="btn btn--ghost" href="/welcome">Back to start</a>
			</div>
		</main>
	{:else if metrics}
		<header class="deck-top">
			<div class="deck-top-inner shell">
				<div class="statusbar" aria-hidden="true">
					<span class="sb-rec">REC ●</span>
					<span class="sb-title">{slideTitles[slide]}</span>
					<span class="sb-folio"
						>SLIDE {(slide + 1).toString().padStart(2, '0')}/{TOTAL_SLIDES}</span
					>
				</div>
				<div class="progress-row">
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
			</div>
		</header>

		<main id="main-content" class="stage shell" tabindex="-1">
			{#key slide}
				<section class="slide fade-up" aria-labelledby="slide-heading">
					{#if slide === 0}
						<p class="eyebrow">Developer Wrapped</p>
						<h1 id="slide-heading" tabindex="-1">
							Your year, with receipts.<span class="caret" aria-hidden="true"></span>
						</h1>
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
						<div class="source-stamp">
							<span class="tag">SOURCE</span>
							<span class="val"
								>period=<b>{metrics.period.key}</b>, coverage=<b>{metrics.coverage}</b></span
							>
						</div>
					{:else if slide === 1}
						<p class="eyebrow">The volume</p>
						<div class="bignum-frame">
							<span class="bignum-cap">Total contributions</span>
							<p class="big-number">{fmt(metrics.totals.contributions)}</p>
						</div>
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
						<div class="source-stamp">
							<span class="tag">SOURCE</span>
							<span class="val"
								>total_contributions=<b>{metrics.totals.contributions}</b>, active_days=<b
									>{metrics.activeDays}</b
								></span
							>
						</div>
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
						<div class="source-stamp">
							<span class="tag">SOURCE</span>
							<span class="val">busiest_month, busiest_weekday, longest_streak, peak_day</span>
						</div>
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
						<div class="source-stamp">
							<span class="tag">SOURCE</span>
							<span class="val"
								>pull_requests=<b>{metrics.totals.pullRequests}</b>, reviews=<b
									>{metrics.totals.reviews}</b
								>, issues=<b>{metrics.totals.issues}</b>, commits=<b>{metrics.totals.commits}</b
								></span
							>
						</div>
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
								Public repositories only; private ones stay uncounted and unnamed.
							</p>
						{:else}
							<p class="hero-line">No public language data this year. A ghost. Respect.</p>
						{/if}
						<div class="source-stamp">
							<span class="tag">SOURCE</span>
							<span class="val"
								>repositories_contributed_to=<b>{metrics.repositories.contributedTo}</b>,
								public_language_mix</span
							>
						</div>
					{:else if slide === 5}
						<p class="eyebrow">The observation</p>
						<span class="big-emoji" aria-hidden="true">🔎</span>
						<h1 id="slide-heading" tabindex="-1">We noticed something.</h1>
						{#if observation}
							<p class="hero-line">{observation.text}</p>
							<div class="source-stamp">
								<span class="tag">SOURCE</span>
								<span class="val">{observation.source}</span>
							</div>
						{/if}
					{:else if slide === 6}
						<p class="eyebrow">You said vs. GitHub says</p>
						{#if quizArchetype && githubArchetype}
							<h1 id="slide-heading" tabindex="-1">The confrontation</h1>
							<div class="versus">
								<div class="versus-side versus-side--said">
									<p class="versus-label">You said</p>
									<span class="versus-emoji" aria-hidden="true">{quizArchetype.emoji}</span>
									<p class="versus-name">{quizArchetype.name}</p>
								</div>
								<span class="versus-vs" aria-hidden="true">vs</span>
								<div class="versus-side versus-side--verdict">
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
								<div class="source-stamp">
									<span class="tag">SOURCE</span>
									<span class="val">{verdict.reason.source}</span>
								</div>
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
						<div class="verdict-head">
							<p class="eyebrow">The verdict</p>
							<span class="stamp-mark verdict-stamp" aria-hidden="true">Certified · Exhibit A</span>
						</div>
						{#if githubArchetype && verdict}
							<article class="ticket">
								<div class="ticket__in">
									<span class="big-emoji" aria-hidden="true">{githubArchetype.emoji}</span>
									<h1 id="slide-heading" tabindex="-1">
										GitHub says: {githubArchetype.name}
									</h1>
									<p class="hero-line">{verdict.reason.text}</p>
									<div class="barcode-row">
										<div class="barcode-cap">
											<span>NO RETURNS · NO REFUNDS</span>
											<span>GITHUB HAS TESTIFIED</span>
										</div>
										<div class="barcode" aria-hidden="true"></div>
									</div>
									<div class="source-stamp">
										<span class="tag">SOURCE</span>
										<span class="val">{verdict.reason.source}</span>
									</div>
								</div>
							</article>
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
										issues, longest streak, busiest month, and top languages. Nothing else, and you
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
								<p class="card-error" role="alert">That didn't go through. Try again.</p>
							{/if}

							<button class="btn btn--subtle share-trigger" type="button" onclick={openShare}>
								Get your share card
							</button>

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

		<!-- Share-card modal: a focused "printout" of the shareable image. -->
		<dialog
			class="share-modal"
			bind:this={shareDialog}
			onclose={() => (shareOpen = false)}
			onclick={backdropClose}
			aria-labelledby="share-modal-title"
		>
			<div class="share-modal__sheet">
				<div class="statusbar share-modal__bar">
					<span class="sb-rec">REC ●</span>
					<span class="sb-title" id="share-modal-title">Share card</span>
					<button class="sb-close" type="button" onclick={closeShare} aria-label="Close share card">
						✕
					</button>
				</div>
				<div class="share-modal__body">
					<p class="eyebrow">Print it · post it</p>
					<div
						class="card-preview"
						style:aspect-ratio={PREVIEW_RATIOS[previewShownFormat]}
						class:card-preview--wide={previewShownFormat === 'square'}
						class:card-preview--updating={previewPending && Boolean(cardPreviewUrl)}
					>
						{#if cardPreviewUrl}
							<img
								src={cardPreviewUrl}
								alt="Share card preview, {CARD_FORMATS.find((f) => f.id === previewShownFormat)
									?.label} format"
							/>
						{:else}
							<p class="card-preview-loading" role="status">Rendering preview…</p>
						{/if}
					</div>
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
					<div class="share-actions">
						<button
							class="btn"
							type="button"
							onclick={downloadCard}
							disabled={cardBusy}
							aria-busy={cardBusy}
						>
							{cardBusy ? 'Rendering card…' : '↧ Download card'}
						</button>
						{#if canNativeShare}
							<button class="btn btn--ghost" type="button" onclick={shareCard} disabled={cardBusy}>
								Share…
							</button>
						{/if}
					</div>
					{#if cardError}
						<p class="card-error" role="alert">Couldn't render the card. Try again.</p>
					{/if}
					<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{actionStatus}</p>
				</div>
			</div>
		</dialog>
	{/if}
</div>

<style>
	/* The deck is a printout: warm paper, no glow. The body supplies the
	   fibrous grain; the deck just lays out the receipt column. */
	.deck {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		background: transparent;
	}

	/* ============================================================
	   LOADING — the "NOW PRINTING" printer-feed moment.
	   ============================================================ */
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

	.load-eyebrow {
		margin-top: 0.25rem;
	}

	/* A little thermal printer feeding a receipt out of its slot. */
	.printer {
		position: relative;
		width: 8.5rem;
		height: 5.5rem;
	}

	.printer-slot {
		position: absolute;
		inset: 0 0 auto 0;
		height: 1.5rem;
		background: var(--ink);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		z-index: 2;
	}

	.printer-slot::after {
		content: '';
		position: absolute;
		left: 12%;
		right: 12%;
		bottom: 0.32rem;
		height: 0.28rem;
		background: var(--paper-2);
		box-shadow: inset 0 0 0 1px rgba(27, 23, 18, 0.5);
		border-radius: 999px;
	}

	.printer-sheet {
		position: absolute;
		top: 1.1rem;
		left: 50%;
		width: 68%;
		transform: translateX(-50%);
		background: var(--receipt);
		border: 1px solid var(--rule);
		border-top: 0;
		box-shadow: var(--shadow-card);
		padding: 0.65rem 0.7rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.32rem;
		overflow: hidden;
		animation: feed 1.9s ease-in-out infinite;
	}

	.printer-line {
		height: 0.28rem;
		border-radius: 999px;
		background: var(--rule);
	}

	.printer-line:nth-child(1) {
		width: 100%;
		background: var(--accent);
	}
	.printer-line:nth-child(2) {
		width: 82%;
	}
	.printer-line:nth-child(3) {
		width: 92%;
	}
	.printer-line:nth-child(4) {
		width: 60%;
	}

	@keyframes feed {
		0% {
			clip-path: inset(0 0 100% 0);
		}
		55% {
			clip-path: inset(0 0 0 0);
		}
		100% {
			clip-path: inset(0 0 0 0);
		}
	}

	.pulse {
		animation: pulse-soft 1.6s ease-in-out infinite;
	}

	/* ============================================================
	   ERROR STATE — a voided receipt.
	   ============================================================ */
	.error-state {
		gap: 0.75rem;
	}

	.error-stamp {
		align-self: center;
		transform: rotate(-5deg);
		font-size: 0.6875rem;
		margin-bottom: 0.25rem;
	}

	.error-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		max-width: 20rem;
		margin-top: 0.75rem;
	}

	/* ============================================================
	   DECK CHROME — status bar + segmented progress.
	   ============================================================ */
	.deck-top {
		position: sticky;
		top: 0;
		z-index: 10;
		padding-top: env(safe-area-inset-top);
		background: color-mix(in srgb, var(--paper) 88%, transparent);
		backdrop-filter: blur(6px);
		border-bottom: 1px solid var(--rule-2);
	}

	.deck-top-inner {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-block: 0.625rem 0.75rem;
	}

	.statusbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.sb-rec {
		color: var(--stamp-ink);
		white-space: nowrap;
	}

	.sb-title {
		flex: 1;
		text-align: center;
		color: var(--ink);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sb-folio {
		white-space: nowrap;
	}

	.progress-row {
		display: flex;
		align-items: center;
		gap: 0.875rem;
	}

	.segments {
		flex: 1;
		display: flex;
		gap: 0.3125rem;
	}

	.segment {
		flex: 1;
		height: 0.4375rem;
		border: 1px solid var(--rule);
		background: var(--band);
	}

	.segment.done {
		background: var(--accent);
		border-color: var(--accent);
	}

	.skip {
		border: 0;
		background: none;
		color: var(--muted);
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		cursor: pointer;
		min-height: 2.75rem;
		padding-inline: 0.5rem;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.skip:hover {
		color: var(--stamp-ink);
	}

	/* ============================================================
	   STAGE + SLIDES
	   ============================================================ */
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
		font-weight: 700;
	}

	.slide h1:focus {
		outline: none;
	}

	/* Long-form narration reads in sans for legibility. */
	.hero-line {
		font-family: var(--sans);
		font-size: 1.125rem;
		line-height: 1.55;
		max-width: 28rem;
		text-wrap: balance;
	}

	.hero-line strong {
		color: var(--accent-ink);
		font-weight: 700;
	}

	/* THE VOLUME — a solid-ink number framed like the mockup's bignum. */
	.bignum-frame {
		position: relative;
		width: 100%;
		max-width: 22rem;
		margin-top: 0.5rem;
		padding: 1.5rem 1rem 1.125rem;
		border: 1.5px solid var(--ink);
		border-radius: var(--radius-md);
		background: linear-gradient(0deg, rgba(27, 23, 18, 0.03), transparent 45%);
	}

	.bignum-cap {
		position: absolute;
		top: -0.55rem;
		left: 50%;
		transform: translateX(-50%);
		padding: 0 0.625rem;
		background: var(--paper);
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
		font-size: clamp(3.5rem, 18vw, 5.5rem);
		font-weight: 700;
		line-height: 0.95;
		letter-spacing: -0.02em;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}

	.big-emoji {
		font-size: 4rem;
		line-height: 1;
	}

	/* ============================================================
	   LEDGER FACTS — receipt line items with dot leaders.
	   ============================================================ */
	.facts {
		display: flex;
		flex-direction: column;
		width: 100%;
		max-width: 26rem;
		margin: 0.5rem 0 0;
		font-family: var(--mono);
	}

	.facts div {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75ch;
		padding: 0.6rem 0.25rem;
		border-bottom: 1px dotted var(--rule);
	}

	.facts div:first-child {
		border-top: 1px dotted var(--rule);
	}

	.facts dt {
		font-size: 0.8125rem;
		font-weight: 400;
		color: var(--muted);
		text-align: left;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.facts dd {
		margin: 0;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		text-align: right;
		overflow-wrap: anywhere;
		color: var(--ink);
	}

	/* ============================================================
	   THE TERRITORY — printed meter rows for the language mix.
	   ============================================================ */
	.langs {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		width: 100%;
		max-width: 26rem;
		list-style: none;
		padding: 0;
		margin-top: 0.5rem;
		font-family: var(--mono);
	}

	.langs li {
		display: grid;
		grid-template-columns: minmax(5.5rem, auto) 1fr 3rem;
		align-items: center;
		gap: 0.75rem;
	}

	.lang-name {
		font-size: 0.8125rem;
		font-weight: 700;
		text-align: left;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		overflow-wrap: anywhere;
	}

	.lang-bar {
		height: 0.75rem;
		border: 1px solid var(--rule);
		background: var(--band);
		overflow: hidden;
	}

	.lang-fill {
		display: block;
		height: 100%;
		background-color: var(--accent);
		background-image: repeating-linear-gradient(
			45deg,
			rgba(251, 249, 243, 0.28) 0 3px,
			transparent 3px 6px
		);
	}

	.lang-share {
		font-size: 0.8125rem;
		font-weight: 700;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	/* ============================================================
	   THE CONFRONTATION — "you said" (struck, pen) vs "GitHub says".
	   ============================================================ */
	.versus {
		display: flex;
		align-items: stretch;
		justify-content: center;
		gap: 0.875rem;
		width: 100%;
		max-width: 30rem;
		margin-top: 0.5rem;
	}

	.versus-side {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.375rem;
		padding: 1rem 0.75rem;
		border: 1px solid var(--rule);
		border-radius: var(--radius-md);
		background: var(--receipt);
		min-width: 0;
	}

	.versus-side--said {
		border-color: color-mix(in srgb, var(--pen) 55%, var(--rule));
		background: rgba(39, 75, 122, 0.05);
	}

	.versus-side--verdict {
		border-color: color-mix(in srgb, var(--accent) 55%, var(--rule));
	}

	.versus-label {
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		color: var(--muted);
	}

	.versus-side--said .versus-label {
		color: var(--pen);
	}

	.versus-side--verdict .versus-label {
		color: var(--accent-ink);
	}

	.versus-emoji {
		font-size: 2.25rem;
		line-height: 1;
	}

	.versus-name {
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.9375rem;
		overflow-wrap: anywhere;
	}

	/* "You said" is struck through in pen — the claim the log overrules. */
	.versus-side--said .versus-name {
		color: var(--pen);
		text-decoration: line-through;
		text-decoration-color: rgba(39, 75, 122, 0.55);
	}

	.versus-side--verdict .versus-name {
		color: var(--accent-ink);
	}

	.versus-vs {
		align-self: center;
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.quiz-cta {
		margin-top: 0.5rem;
		max-width: 20rem;
	}

	/* ============================================================
	   THE VERDICT — a certified ticket stub.
	   ============================================================ */
	.verdict-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		max-width: 30rem;
	}

	.verdict-stamp {
		animation: stamp-in 420ms ease both;
	}

	.ticket {
		position: relative;
		width: 100%;
		max-width: 30rem;
		background: var(--receipt);
		border: 1.5px solid var(--ink);
		box-shadow: var(--shadow-card);
		--notch: 13px;
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

	.ticket__in {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.875rem;
		padding: 1.5rem 1.375rem 1.375rem;
	}

	.barcode-row {
		width: 100%;
		margin-top: 0.25rem;
	}

	.barcode-cap {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-family: var(--mono);
		font-size: 0.5625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--muted);
		margin-bottom: 0.375rem;
	}

	/* ============================================================
	   PUBLISH + SHARE CONTROLS
	   ============================================================ */
	.publish {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		width: 100%;
		max-width: 30rem;
		margin-top: 1.25rem;
	}

	.publish-box {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.125rem;
		border: 1px solid var(--rule);
		border-left: 3px solid var(--pen);
		border-radius: var(--radius-md);
		background: rgba(39, 75, 122, 0.055);
		text-align: left;
	}

	.publish-title {
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.75rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--pen);
	}

	/* Sober register: the privacy paragraph reads calmly in sans. */
	.publish-copy {
		font-family: var(--sans);
		font-size: 0.9075rem;
		line-height: 1.55;
	}

	.share-url {
		font-family: var(--mono);
		font-size: 0.8125rem;
		font-weight: 700;
		overflow-wrap: anywhere;
		color: var(--accent-ink);
	}

	.share-trigger {
		max-width: 30rem;
	}

	.card-preview {
		align-self: center;
		height: clamp(14rem, 42vh, 21rem);
		max-width: 100%;
		border: 1px solid var(--rule);
		border-radius: var(--radius-sm);
		background: var(--paper-2);
		box-shadow: var(--shadow-card);
		overflow: hidden;
		display: grid;
		place-items: center;
	}

	.card-preview--wide {
		height: clamp(12rem, 34vh, 18rem);
	}

	.card-preview img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		transition: opacity 150ms ease;
	}

	.card-preview--updating img {
		opacity: 0.55;
	}

	.card-preview-loading {
		padding: 1rem;
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--muted);
		animation: pulse-soft 1.4s ease-in-out infinite;
	}

	.formats {
		display: flex;
		gap: 0.5rem;
	}

	.format {
		flex: 1;
		min-height: 2.75rem;
		padding: 0.5rem 0.625rem;
		border: 1px solid var(--ink);
		border-radius: var(--radius-sm);
		background: var(--receipt);
		color: var(--ink);
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		box-shadow: var(--shadow-hard) var(--rule-2);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.format:hover {
		transform: translate(-1px, -1px);
		box-shadow: 5px 5px 0 var(--rule-2);
	}

	.format.active {
		background: var(--ink);
		color: var(--receipt);
		box-shadow: var(--shadow-hard) var(--accent);
	}

	.card-error {
		font-family: var(--mono);
		font-size: 0.8125rem;
		color: var(--warn);
	}

	.resync {
		align-self: center;
		border: 0;
		background: none;
		color: var(--muted);
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 0.2em;
		min-height: 2.75rem;
	}

	.resync:hover {
		color: var(--stamp-ink);
	}

	/* ============================================================
	   SHARE-CARD MODAL — a focused "printout" dialog.
	   ============================================================ */
	.share-modal {
		width: min(92vw, 25rem);
		max-width: 92vw;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--ink);
		margin: auto;
	}

	.share-modal::backdrop {
		background: rgba(27, 23, 18, 0.55);
		backdrop-filter: blur(2px);
	}

	.share-modal__sheet {
		background: var(--receipt);
		border: 1.5px solid var(--ink);
		border-radius: var(--radius-lg);
		box-shadow: 8px 10px 0 rgba(27, 23, 18, 0.18);
		overflow: hidden;
	}

	.share-modal[open] .share-modal__sheet {
		animation: modal-in 220ms ease both;
	}

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	.share-modal__bar {
		padding: 0.5rem 0.6rem 0.5rem 0.9rem;
		background: var(--ink);
	}

	.share-modal__bar .sb-rec {
		color: var(--paper);
	}

	.share-modal__bar .sb-title {
		color: var(--receipt);
	}

	.sb-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 1.75rem;
		flex-shrink: 0;
		border: 0;
		background: none;
		color: var(--receipt);
		font-family: var(--mono);
		font-size: 0.9rem;
		cursor: pointer;
		border-radius: var(--radius-sm);
	}

	.sb-close:hover {
		background: rgba(251, 249, 243, 0.16);
	}

	.share-modal__body {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.875rem;
		padding: 1.125rem 1.125rem 1.375rem;
		text-align: center;
	}

	.share-actions {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		width: 100%;
	}

	/* ============================================================
	   DECK NAV — perforated footer with mono controls.
	   ============================================================ */
	.deck-nav {
		position: sticky;
		bottom: 0;
		padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
		background: color-mix(in srgb, var(--paper) 88%, transparent);
		backdrop-filter: blur(8px);
		border-top: 2px dashed var(--rule);
	}

	.deck-nav-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding-block: 0.75rem;
	}

	.nav-btn {
		min-height: 2.75rem;
		padding: 0.5rem 1.125rem;
		border: 1px solid var(--ink);
		border-radius: var(--radius-md);
		background: var(--receipt);
		color: var(--ink);
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		box-shadow: var(--shadow-hard) var(--rule-2);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.nav-btn:not(:disabled):hover {
		transform: translate(-1px, -1px);
		box-shadow: 5px 5px 0 var(--rule-2);
	}

	.nav-btn--primary {
		background: var(--ink);
		color: var(--receipt);
		box-shadow: var(--shadow-hard) var(--accent);
	}

	.nav-btn--primary:not(:disabled):hover {
		box-shadow: 5px 5px 0 var(--accent);
	}

	.nav-btn:disabled {
		opacity: 0.4;
		cursor: default;
		box-shadow: var(--shadow-hard) var(--rule-2);
	}

	.counter {
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.08em;
		color: var(--muted);
	}
</style>

<script lang="ts">
	import { goto } from '$app/navigation';
	import Seo from '$lib/components/Seo.svelte';
	import { getArchetype } from '$lib/content/archetypes';
	import { computeScores, rankArchetypes } from '$lib/scoring';
	import { parseQuestion } from '$lib/types';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Scoring runs once on the loaded snapshot — the reveal is a terminal screen.
	// svelte-ignore state_referenced_locally
	const questions = data.questions.map(parseQuestion);
	// svelte-ignore state_referenced_locally
	const selections = new Map(data.answers.map((a) => [a.question_id, a.option_id]));

	// Deterministic, fully client-side scoring from DB-provided weights.
	const scores = computeScores(questions, selections);
	const { primary, secondary } = rankArchetypes(scores);
	const primaryArchetype = getArchetype(primary);
	const secondaryArchetype = getArchetype(secondary);

	type Phase = 'calculating' | 'slide-1' | 'slide-2' | 'slide-3' | 'failed';
	let phase = $state<Phase>('calculating');
	let shareSlug = $state<string | null>(null);

	const revealAnnouncement = $derived(
		phase === 'slide-1'
			? 'Reveal step 1 of 3. The results are in. We ran the numbers.'
			: phase === 'slide-2'
				? `Reveal step 2 of 3. We detected traces of ${secondaryArchetype.name}.`
				: phase === 'slide-3'
					? 'Reveal step 3 of 3. Your official diagnosis is ready.'
					: ''
	);

	function randomSlug(): string {
		const bytes = crypto.getRandomValues(new Uint8Array(8));
		return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	}

	async function saveResult(): Promise<void> {
		const res = await fetch('/api/results', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				user_id: data.userId,
				archetype_id: primary,
				secondary_archetype_id: secondary,
				scores_json: JSON.stringify(scores),
				share_slug: randomSlug(),
				// Private by default — publishing is an explicit step on the result page.
				is_public: false,
				completed_at: new Date().toISOString()
			})
		});
		if (!res.ok) throw new Error(`result save failed (${res.status})`);
		shareSlug = ((await res.json()) as { share_slug: string }).share_slug;
	}

	function finish() {
		if (shareSlug) goto(`/r/${shareSlug}?new=1`, { replaceState: true });
	}

	function skip() {
		if (phase === 'calculating' || phase === 'failed') return;
		if (phase === 'slide-3') {
			finish();
			return;
		}
		phase = phase === 'slide-1' ? 'slide-2' : 'slide-3';
	}

	async function start() {
		phase = 'calculating';
		const minimumDrama = new Promise((resolve) => setTimeout(resolve, 1700));
		try {
			await Promise.all([saveResult(), minimumDrama]);
			phase = 'slide-1';
		} catch {
			phase = 'failed';
		}
	}

	onMount(() => {
		void start();
	});
</script>

<Seo
	title="Calculating your result — Developer Wrapped"
	description="Crunching your answers into one uncomfortably accurate developer archetype."
	noindex
/>

<main
	id="main-content"
	class="screen"
	tabindex="-1"
	style:--tint-a={phase === 'slide-2'
		? secondaryArchetype.gradient[0]
		: primaryArchetype.gradient[0]}
	style:--tint-b={phase === 'slide-2'
		? secondaryArchetype.gradient[1]
		: primaryArchetype.gradient[1]}
>
	<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
		{revealAnnouncement}
	</p>
	{#if phase === 'calculating'}
		<div class="slide shell" role="status" aria-live="polite">
			<div class="orb" aria-hidden="true"></div>
			<h1 class="pulse">Judging your life choices…</h1>
			<p class="muted">Cross-referencing your answers against known developer disorders.</p>
		</div>
	{:else if phase === 'failed'}
		<div class="slide shell" role="alert">
			<span class="big-emoji" aria-hidden="true">📡</span>
			<h1>The verdict got lost in transit</h1>
			<p class="muted">Your answers are safe — we just couldn't save the result. Try again.</p>
			<button class="btn" type="button" onclick={start}>Retry the reveal</button>
		</div>
	{:else}
		<section class="slide shell">
			{#if phase === 'slide-1'}
				<div class="reveal-copy fade-up">
					<p class="eyebrow">The results are in</p>
					<h1>We ran the numbers.</h1>
					<p class="sub">There were… concerns.</p>
				</div>
			{:else if phase === 'slide-2'}
				<div class="reveal-copy fade-up">
					<p class="eyebrow">First, a clue</p>
					<span class="big-emoji" aria-hidden="true">{secondaryArchetype.emoji}</span>
					<h1>We detected traces of {secondaryArchetype.name}.</h1>
					<p class="sub">But that's not the whole story.</p>
				</div>
			{:else}
				<div class="reveal-copy fade-up">
					<p class="eyebrow">Your official diagnosis</p>
					<h1>Deep down, you are…</h1>
					<p class="sub">brace yourself</p>
				</div>
			{/if}
			<button
				class="slide-button"
				type="button"
				onclick={skip}
				aria-label={phase === 'slide-3' ? 'Show my result' : 'Continue reveal'}
			>
				<span class="hint muted">{phase === 'slide-3' ? 'See my result' : 'Continue'}</span>
			</button>
		</section>
	{/if}
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		background:
			radial-gradient(
				60rem 40rem at 50% -20%,
				color-mix(in srgb, var(--tint-a) 26%, transparent),
				transparent 70%
			),
			radial-gradient(
				50rem 36rem at 50% 120%,
				color-mix(in srgb, var(--tint-b) 18%, transparent),
				transparent 70%
			),
			var(--bg);
		transition: background 600ms ease;
	}

	.slide {
		position: relative;
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		text-align: center;
		padding-block: 3rem;
	}

	.slide-button {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 3rem 1.25rem;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		width: 100%;
		touch-action: manipulation;
	}

	.reveal-copy {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.slide-button:focus-visible {
		outline-offset: -6px;
	}

	h1 {
		font-size: clamp(1.875rem, 8vw, 2.75rem);
		font-weight: 900;
	}

	.sub {
		font-size: 1.125rem;
		color: var(--muted);
	}

	.big-emoji {
		font-size: 4rem;
		line-height: 1;
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

	.hint {
		font-size: 0.875rem;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>

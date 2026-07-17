<script lang="ts">
	import { goto } from '$app/navigation';
	import Seo from '$lib/components/Seo.svelte';
	import { computeScores, rankArchetypes } from '$lib/scoring';
	import { parseQuestion, type QuizOption } from '$lib/types';
	import { tick } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The quiz works on a snapshot of the loaded questions/answers; selections
	// diverge from server data by design (optimistic saves).
	// svelte-ignore state_referenced_locally
	const questions = data.questions.map(parseQuestion);
	const total = questions.length;

	// question id -> selected option id, seeded from saved answers (resume on refresh)
	// svelte-ignore state_referenced_locally
	let selections = $state<Record<string, string>>(
		Object.fromEntries(data.answers.map((a) => [a.question_id, a.option_id]))
	);

	const firstUnanswered = questions.findIndex((q) => !selections[q.id]);
	let index = $state(firstUnanswered === -1 ? 0 : firstUnanswered);
	let saveError = $state(false);
	let finishing = $state(false);
	let finishError = $state(false);
	let advanceTimer: ReturnType<typeof setTimeout> | undefined;
	// Monotonic token per question so a stale save failure can never clobber a
	// newer selection the user made in the meantime.
	let saveSeq = 0;
	const latestSave: Record<string, number> = {};
	// Every in-flight (or settled) save, keyed by question. Submitting the
	// result waits for ALL of them, not just the final question's save, so a
	// slow earlier save can never be lost behind the redirect.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- bookkeeping only, never rendered
	const pendingSaves = new Map<string, Promise<boolean>>();

	const question = $derived(questions[index]);
	const answeredCount = $derived(questions.filter((q) => selections[q.id]).length);

	$effect(() => {
		// Move focus to the new prompt each time the question changes.
		void index;
		tick().then(() => document.getElementById('question-heading')?.focus());
		return () => clearTimeout(advanceTimer);
	});

	function select(option: QuizOption) {
		const q = question;
		const previous = selections[q.id];
		selections[q.id] = option.id;
		saveError = false;
		finishError = false;
		finishing = false;
		clearTimeout(advanceTimer);
		const token = ++saveSeq;
		latestSave[q.id] = token;

		// Save immediately; the UI is optimistic and reverts on failure.
		const save = fetch('/api/answers', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				user_id: data.userId,
				question_id: q.id,
				option_id: option.id,
				answered_at: new Date().toISOString()
			})
		})
			.then((res) => {
				if (!res.ok) throw new Error(`save failed (${res.status})`);
				return true;
			})
			.catch(() => {
				// A newer selection for this question owns the state now.
				if (latestSave[q.id] !== token) return false;
				clearTimeout(advanceTimer);
				finishing = false;
				if (previous) selections[q.id] = previous;
				else delete selections[q.id];
				const failedIndex = questions.findIndex((entry) => entry.id === q.id);
				if (failedIndex !== -1) index = failedIndex;
				saveError = true;
				return false;
			});

		pendingSaves.set(q.id, save);
		advanceTimer = setTimeout(() => advance(), 450);
	}

	function randomSlug(): string {
		const bytes = crypto.getRandomValues(new Uint8Array(8));
		return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Persist the quiz result; the server re-scores the saved answers and 409s
	 * on drift, so the submitted archetypes must come from the same selections
	 * the saves just wrote.
	 */
	async function saveResult(): Promise<void> {
		const scores = computeScores(questions, new Map(Object.entries(selections)));
		const { primary, secondary } = rankArchetypes(scores);
		const res = await fetch('/api/results', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				user_id: data.userId,
				archetype_id: primary,
				secondary_archetype_id: secondary,
				scores_json: JSON.stringify(scores),
				share_slug: randomSlug(),
				// Private by default — publishing is an explicit step on the Wrapped page.
				is_public: false,
				completed_at: new Date().toISOString()
			})
		});
		if (!res.ok) throw new Error(`result save failed (${res.status})`);
	}

	async function advance() {
		if (index < total - 1) {
			index += 1;
			return;
		}
		const unanswered = questions.findIndex((q) => !selections[q.id]);
		if (unanswered !== -1) {
			index = unanswered;
			return;
		}
		// Final question: the result is scored from saved answers server-side, so
		// every save must have landed before submitting. Re-answering during the
		// wait replaces map entries, so loop until a full snapshot settles clean.
		finishing = true;
		finishError = false;
		for (;;) {
			const snapshot = [...pendingSaves.values()];
			const results = await Promise.all(snapshot);
			if (!results.every(Boolean)) {
				// A save failed and its catch handler already reverted the answer.
				finishing = false;
				return;
			}
			const after = [...pendingSaves.values()];
			if (after.length === snapshot.length && after.every((p, i) => p === snapshot[i])) break;
		}
		if (questions.some((q) => !selections[q.id])) {
			finishing = false;
			return;
		}
		// Straight to the consolidated Wrapped: GitHub data has been assimilating
		// in the background since sign-in, and the deck folds this result into
		// its "you said vs. GitHub says" confrontation.
		try {
			await saveResult();
		} catch {
			finishing = false;
			finishError = true;
			return;
		}
		await goto('/wrapped');
	}

	function back() {
		clearTimeout(advanceTimer);
		if (index > 0) index -= 1;
	}
</script>

<Seo
	title="The eight questions | Developer Wrapped"
	description="Answer eight uncomfortably accurate questions about how you really build software."
	noindex
/>

<div class="quiz">
	<header class="topbar">
		<div class="topbar-inner shell">
			<button
				class="back"
				type="button"
				onclick={back}
				disabled={index === 0}
				aria-label="Previous question"
			>
				<svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
					<path
						d="M12.5 15.5 7 10l5.5-5.5"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</button>
			<div class="meter">
				<div class="meter-head" aria-hidden="true">
					<span class="meter-label">Now examining</span>
					<span class="counter"
						>{String(index + 1).padStart(2, '0')}/{String(total).padStart(2, '0')}</span
					>
				</div>
				<div
					class="progress"
					role="progressbar"
					aria-label="Quiz progress"
					aria-valuemin={1}
					aria-valuemax={total}
					aria-valuenow={index + 1}
					aria-valuetext="Question {index + 1} of {total}"
				>
					<div class="progress-track">
						<div class="progress-fill" style:width="{((index + 1) / total) * 100}%"></div>
					</div>
				</div>
			</div>
		</div>
	</header>

	<main id="main-content" class="stage shell" tabindex="-1">
		{#key index}
			<section class="question fade-up">
				<div class="q-head">
					<p class="eyebrow">Cross-examination</p>
					<span class="q-exhibit" aria-hidden="true"
						>Exhibit {String(index + 1).padStart(2, '0')}</span
					>
				</div>
				<h1 id="question-heading" tabindex="-1">
					{question.prompt}<span class="caret" aria-hidden="true"></span>
				</h1>
				<fieldset class="options">
					<legend class="sr-only">Choose one answer for: {question.prompt}</legend>
					{#each question.options as option (option.id)}
						{@const selected = selections[question.id] === option.id}
						<label class="option" class:selected>
							<input
								class="option-input"
								type="radio"
								name="question-{question.id}"
								value={option.id}
								checked={selected}
								onchange={() => select(option)}
							/>
							<span class="option-emoji" aria-hidden="true">{option.emoji}</span>
							<span class="option-label">{option.label}</span>
							<span class="option-mark" aria-hidden="true">
								{#if selected}
									<svg
										class="check pop-in"
										width="22"
										height="22"
										viewBox="0 0 22 22"
										fill="none"
										aria-hidden="true"
									>
										<circle cx="11" cy="11" r="11" fill="currentColor" opacity="0.9" />
										<path
											d="m6.5 11.5 3 3 6-6.5"
											stroke="#0f172a"
											stroke-width="2.4"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								{/if}
							</span>
						</label>
					{/each}
				</fieldset>
			</section>
		{/key}

		{#if saveError}
			<p class="save-error" role="alert">
				That answer didn't save. Check your connection and tap it again.
			</p>
		{/if}

		{#if finishError}
			<div class="save-error" role="alert">
				<p>Your answers are safe; we just couldn't seal the verdict. Try again.</p>
				<button class="retry" type="button" onclick={advance}>Retry</button>
			</div>
		{/if}

		{#if finishing}
			<p class="finishing" role="status">
				Locking in your verdict<span class="caret" aria-hidden="true"></span>
			</p>
		{/if}

		<p class="sr-only" aria-live="polite">{answeredCount} of {total} questions answered</p>
	</main>
</div>

<style>
	.quiz {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	/* Sticky printer chrome: a labelled ledger meter on receipt stock,
	   crowned by a hard ink hairline like the top of a torn-off slip. */
	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		padding-top: env(safe-area-inset-top);
		background: var(--receipt);
		border-bottom: 1px solid var(--ink);
		box-shadow: 0 2px 0 var(--rule-2);
	}

	.topbar-inner {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding-block: 0.625rem;
	}

	.back {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		flex-shrink: 0;
		border: 1px solid var(--ink);
		border-radius: var(--radius-sm);
		background: var(--receipt);
		color: var(--ink);
		cursor: pointer;
		box-shadow: var(--shadow-hard) var(--rule-2);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.back:hover:not(:disabled) {
		transform: translate(-1px, -1px);
		box-shadow: 3px 3px 0 var(--rule-2);
	}

	.back:active:not(:disabled) {
		transform: translate(1px, 1px);
		box-shadow: 1px 1px 0 var(--rule-2);
	}

	.back:disabled {
		opacity: 0.35;
		cursor: default;
		box-shadow: none;
	}

	.meter {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.meter-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.meter-label {
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.counter {
		font-family: var(--mono);
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.1em;
		color: var(--ink);
		white-space: nowrap;
	}

	.progress {
		width: 100%;
	}

	/* Printed progress: hatched paper track, solid ink fill with a
	   vermilion "print head" leading edge. */
	.progress-track {
		height: 0.6875rem;
		border: 1px solid var(--ink);
		border-radius: var(--radius-sm);
		background:
			repeating-linear-gradient(45deg, transparent 0 5px, rgba(27, 23, 18, 0.04) 5px 6px),
			var(--paper-2);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		background: var(--ink);
		box-shadow: inset -2px 0 0 var(--accent);
		transition: width 300ms ease;
	}

	.stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-block: 2rem;
	}

	/* Docket kicker row above the prompt (eyebrow + mono exhibit folio). */
	.q-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.875rem;
	}

	.q-exhibit {
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.question h1 {
		font-size: clamp(1.5rem, 6.5vw, 2rem);
		font-weight: 700;
		letter-spacing: -0.01em;
		margin-bottom: 1.5rem;
	}

	/* Option rows read like tappable ledger/receipt lines: a lettered
	   key chip, the choice, and a punch-card selection mark. */
	.options {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
		counter-reset: opt;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		min-height: 3.75rem;
		padding: 0.8125rem 0.9375rem;
		border: 1px solid var(--rule);
		border-radius: var(--radius-md);
		background: var(--receipt);
		color: var(--ink);
		font-size: 1rem;
		text-align: left;
		cursor: pointer;
		box-shadow: var(--shadow-hard) var(--rule-2);
		counter-increment: opt;
		transition:
			border-color 120ms ease,
			background 120ms ease,
			box-shadow 120ms ease,
			transform 120ms ease;
		touch-action: manipulation;
	}

	.option::before {
		content: counter(opt, upper-alpha);
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		width: 1.625rem;
		height: 1.625rem;
		border: 1px solid var(--rule);
		border-radius: var(--radius-sm);
		background: var(--band);
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--muted);
	}

	.option-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
	}

	.option:has(.option-input:focus-visible) {
		outline: 2px solid var(--pen);
		outline-offset: 2px;
	}

	.option:hover {
		border-color: var(--ink);
		transform: translate(-1px, -1px);
		box-shadow: 3px 3px 0 var(--rule-2);
	}

	.option:active {
		transform: translate(1px, 1px);
		box-shadow: 1px 1px 0 var(--rule-2);
	}

	.option.selected {
		border-color: var(--ink);
		background: var(--stamp-band);
		box-shadow: var(--shadow-hard) var(--accent);
	}

	.option.selected::before {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--receipt);
	}

	.option-emoji {
		font-size: 1.375rem;
		flex-shrink: 0;
		line-height: 1;
	}

	.option-label {
		flex: 1;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.option-mark {
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		border: 1.5px solid var(--rule);
		border-radius: 50%;
		background: var(--receipt);
	}

	.option.selected .option-mark {
		border-color: transparent;
		background: transparent;
	}

	.check {
		flex-shrink: 0;
		color: var(--accent);
	}

	/* Errors print as a pen-and-amber marginal note on the slip. */
	.save-error {
		margin-top: 1.25rem;
		padding: 0.875rem 1rem;
		border: 1px solid var(--warn);
		border-left: 3px solid var(--warn);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--warn) 10%, var(--receipt));
		color: var(--ink);
		font-size: 0.9375rem;
	}

	.retry {
		margin-top: 0.625rem;
		min-height: 2.75rem;
		padding: 0.5rem 1.25rem;
		border: 1px solid var(--ink);
		border-radius: var(--radius-md);
		background: var(--receipt);
		color: var(--ink);
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		cursor: pointer;
		box-shadow: var(--shadow-hard) var(--rule-2);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.retry:hover {
		transform: translate(-1px, -1px);
		box-shadow: 3px 3px 0 var(--rule-2);
	}

	.retry:active {
		transform: translate(1px, 1px);
		box-shadow: 1px 1px 0 var(--rule-2);
	}

	.finishing {
		margin-top: 1.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.2ch;
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--muted);
	}
</style>

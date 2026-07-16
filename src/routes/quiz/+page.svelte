<script lang="ts">
	import { goto } from '$app/navigation';
	import Seo from '$lib/components/Seo.svelte';
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
	let advanceTimer: ReturnType<typeof setTimeout> | undefined;

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
		clearTimeout(advanceTimer);

		// Save immediately; the UI is optimistic and reverts on failure.
		fetch('/api/answers', {
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
			})
			.catch(() => {
				clearTimeout(advanceTimer);
				if (previous) selections[q.id] = previous;
				else delete selections[q.id];
				const failedIndex = questions.findIndex((entry) => entry.id === q.id);
				if (failedIndex !== -1) index = failedIndex;
				saveError = true;
			});

		advanceTimer = setTimeout(advance, 450);
	}

	function advance() {
		if (index < total - 1) {
			index += 1;
			return;
		}
		const unanswered = questions.findIndex((q) => !selections[q.id]);
		if (unanswered !== -1) {
			index = unanswered;
			return;
		}
		goto('/reveal');
	}

	function back() {
		clearTimeout(advanceTimer);
		if (index > 0) index -= 1;
	}
</script>

<Seo
	title="The eight questions — Developer Wrapped"
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
			<span class="counter" aria-hidden="true">{index + 1}/{total}</span>
		</div>
	</header>

	<main id="main-content" class="stage shell" tabindex="-1">
		{#key index}
			<section class="question fade-up">
				<h1 id="question-heading" tabindex="-1">{question.prompt}</h1>
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
						</label>
					{/each}
				</fieldset>
			</section>
		{/key}

		{#if saveError}
			<p class="save-error" role="alert">
				That answer didn't save — check your connection and tap it again.
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

	.topbar {
		position: sticky;
		top: 0;
		z-index: 10;
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--border-dim);
	}

	.topbar-inner {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding-block: 0.75rem;
	}

	.back {
		display: grid;
		place-items: center;
		width: 2.75rem;
		height: 2.75rem;
		flex-shrink: 0;
		border: 1px solid var(--border-dim);
		border-radius: 50%;
		background: var(--bg-raised);
		color: var(--fg);
		cursor: pointer;
	}

	.back:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.progress {
		flex: 1;
	}

	.progress-track {
		height: 0.5rem;
		border-radius: 999px;
		background: var(--bg-raised);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--accent), #db2777);
		transition: width 300ms ease;
	}

	.counter {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		font-size: 0.9375rem;
		color: var(--muted);
	}

	.stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding-block: 2rem;
	}

	.question h1 {
		font-size: clamp(1.5rem, 6.5vw, 2.125rem);
		font-weight: 800;
		margin-bottom: 1.75rem;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.option {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		width: 100%;
		min-height: 4rem;
		padding: 1rem 1.125rem;
		border: 1.5px solid var(--border-dim);
		border-radius: var(--radius-md);
		background: var(--bg-raised);
		color: var(--fg);
		font-size: 1rem;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
		transition:
			border-color 120ms ease,
			background 120ms ease,
			transform 120ms ease;
		touch-action: manipulation;
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
		outline: 3px solid var(--accent-bright);
		outline-offset: 2px;
	}

	.option:hover {
		border-color: rgba(167, 139, 250, 0.6);
	}

	.option:active {
		transform: scale(0.985);
	}

	.option.selected {
		border-color: var(--accent-bright);
		background: color-mix(in srgb, var(--accent) 28%, var(--bg-raised));
	}

	.option-emoji {
		font-size: 1.375rem;
		flex-shrink: 0;
	}

	.option-label {
		flex: 1;
	}

	.check {
		flex-shrink: 0;
		color: var(--accent-bright);
	}

	.save-error {
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--warn) 18%, var(--bg-raised));
		border: 1px solid color-mix(in srgb, var(--warn) 55%, transparent);
		color: var(--fg);
		font-size: 0.9375rem;
	}
</style>

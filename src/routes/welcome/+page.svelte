<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Seo from '$lib/components/Seo.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const resuming = $derived(data.answeredCount > 0 && data.answeredCount < data.totalQuestions);

	async function signOut() {
		await fetch('/auth/logout', { method: 'POST' });
		await invalidateAll();
		await goto('/');
	}
</script>

<Seo
	title="Ready when you are | Developer Wrapped"
	description="Start your Developer Wrapped: eight questions between you and an uncomfortably accurate diagnosis."
	noindex
/>

<main id="main-content" class="screen shell" tabindex="-1">
	<div class="welcome fade-up">
		<div class="statusbar" aria-hidden="true">
			<span class="live"><i class="rec"></i> SESSION LIVE</span>
			<span class="folio">REG 04 · DW-2026</span>
		</div>

		<div class="pad">
			<p class="merchant-top" aria-hidden="true">— NOW SERVING —</p>

			<div class="avatar-frame">
				<img
					class="avatar"
					src={data.profile.avatar_url}
					alt=""
					width="96"
					height="96"
					referrerpolicy="no-referrer"
				/>
			</div>

			<p class="eyebrow">Well, well, well</p>
			<h1>
				Hey, {data.profile.display_name || data.profile.github_username || 'developer'}
				👋<span class="caret" aria-hidden="true"></span>
			</h1>
			<p class="muted lead">
				Your last 12 months on GitHub started testifying the moment you signed in: aggregate
				contribution counts for an exact period, never your code, all private until you choose to
				publish. The quiz adds an optional "you said vs. GitHub says" confrontation. Two minutes,
				only slightly judgmental.
			</p>

			<div class="source-stamp" aria-hidden="true">
				<span class="tag">SOURCE</span>
				<span class="val"
					>signed_in=<b>{data.profile.github_username || 'developer'}</b>, answered=<b
						>{data.answeredCount}/{data.totalQuestions}</b
					></span
				>
			</div>

			<div class="actions">
				{#if resuming}
					<a class="btn" href="/quiz"
						>Resume quiz ({data.answeredCount}/{data.totalQuestions} answered)</a
					>
				{:else}
					<a class="btn" href="/quiz">{data.currentResult ? 'Retake the quiz' : 'Take the quiz'}</a>
				{/if}
				<a class="btn btn--subtle" href="/wrapped"
					>{data.currentResult ? 'See my Wrapped' : 'Skip to my Wrapped'}</a
				>
			</div>

			<hr class="perf" aria-hidden="true" />

			<button class="signout" type="button" onclick={signOut}>› Not you? Sign out</button>
		</div>
	</div>
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		padding-block: 2rem;
	}

	/* The whole greeting is one printed receipt: hard border, hard shadow. */
	.welcome {
		width: 100%;
		background: var(--receipt);
		border: 1.5px solid var(--ink);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		overflow: hidden;
	}

	/* Machine chrome: the dark status bar across the top of the printout. */
	.statusbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 0.875rem;
		background: var(--ink);
		color: var(--receipt);
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
	}

	.statusbar .live {
		display: inline-flex;
		align-items: center;
		gap: 0.5ch;
	}

	.statusbar .rec {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--stamp);
		animation: pulse-soft 2s ease-in-out infinite;
	}

	.statusbar .folio {
		color: var(--paper-2);
	}

	.pad {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.875rem;
		padding: 1.5rem 1.5rem 1.75rem;
		text-align: center;
	}

	.merchant-top {
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: var(--muted);
	}

	/* Avatar as a notarized stamp: ink ring + dashed inner seal. */
	.avatar-frame {
		position: relative;
		display: inline-flex;
		margin-top: 0.25rem;
	}

	.avatar-frame::after {
		content: '';
		position: absolute;
		inset: 5px;
		border-radius: 50%;
		border: 1px dashed var(--rule);
		pointer-events: none;
	}

	.avatar {
		width: 5.5rem;
		height: 5.5rem;
		border-radius: 50%;
		border: 2px solid var(--ink);
		background: var(--receipt);
		box-shadow:
			0 0 0 2px var(--receipt),
			0 0 0 3.5px var(--ink);
	}

	h1 {
		font-size: clamp(1.75rem, 7vw, 2.25rem);
		max-width: 100%;
		overflow-wrap: anywhere;
	}

	/* Long-form narration stays in the readable sans register. */
	.lead {
		max-width: 24rem;
		font-family: var(--sans);
	}

	/* Hero device: machine-readable receipt line stretched full width. */
	.source-stamp {
		align-self: stretch;
		margin-top: 0.25rem;
		text-align: left;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		margin-top: 0.75rem;
	}

	.perf {
		width: 100%;
		margin-top: 0.5rem;
	}

	/* Sign-out reads as a small terminal command, not a shouty button. */
	.signout {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5ch;
		min-height: 2.75rem;
		padding: 0.5rem 0.75rem;
		background: none;
		border: 0;
		color: var(--muted);
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.signout:hover {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}
</style>

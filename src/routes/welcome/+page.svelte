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
		<img
			class="avatar"
			src={data.profile.avatar_url}
			alt=""
			width="96"
			height="96"
			referrerpolicy="no-referrer"
		/>
		<p class="eyebrow">Well, well, well</p>
		<h1>Hey, {data.profile.display_name || data.profile.github_username || 'developer'} 👋</h1>
		<p class="muted lead">
			Your last 12 months on GitHub started testifying the moment you signed in: aggregate
			contribution counts for an exact period, never your code, all private until you choose to
			publish. The quiz adds an optional "you said vs. GitHub says" confrontation. Two minutes, only
			slightly judgmental.
		</p>

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

		<button class="signout" type="button" onclick={signOut}> Not you? Sign out </button>
	</div>
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		padding-block: 2rem;
	}

	.welcome {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.875rem;
		width: 100%;
		text-align: center;
	}

	.avatar {
		width: 6rem;
		height: 6rem;
		border-radius: 50%;
		border: 3px solid var(--accent);
		background: var(--bg-raised);
	}

	h1 {
		font-size: clamp(1.75rem, 7vw, 2.375rem);
		font-weight: 900;
		max-width: 100%;
		overflow-wrap: anywhere;
	}

	.lead {
		max-width: 24rem;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		margin-top: 1rem;
	}

	.signout {
		margin-top: 0.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.75rem;
		background: none;
		border: 0;
		color: var(--muted);
		font-size: 0.875rem;
		cursor: pointer;
		text-decoration: underline;
		padding: 0.5rem;
	}

	.signout:hover {
		color: var(--fg);
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import ArchetypeCard from '$lib/components/ArchetypeCard.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { getArchetype } from '$lib/content/archetypes';
	import { renderShareCard } from '$lib/share-card';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const archetype = $derived(getArchetype(data.result.archetype_id));
	const secondary = $derived(getArchetype(data.result.secondary_archetype_id));
	const justRevealed = page.url.searchParams.get('new') === '1';

	let copied = $state(false);
	let copyError = $state(false);
	let cardBusy = $state(false);
	let cardError = $state(false);
	let actionStatus = $state('');
	// Visibility toggles optimistically after PATCH; seeded once from the load.
	// svelte-ignore state_referenced_locally
	let isPublic = $state(data.result.is_public);
	let visibilityBusy = $state(false);
	let visibilityError = $state(false);
	let canNativeShare = $state(false);

	onMount(() => {
		canNativeShare = typeof navigator.share === 'function';
	});

	const shareUrl = $derived(`${page.url.origin}/r/${data.result.share_slug}`);
	const shareText = $derived(
		`I got ${archetype.name} ${archetype.emoji} on Developer Wrapped. “${archetype.tagline}”`
	);

	async function copyLink() {
		copyError = false;
		actionStatus = '';
		try {
			await navigator.clipboard.writeText(shareUrl);
			copied = true;
			actionStatus = 'Share link copied to the clipboard.';
			setTimeout(() => (copied = false), 2000);
		} catch {
			copied = false;
			copyError = true;
		}
	}

	async function nativeShare() {
		try {
			await navigator.share({ title: 'Developer Wrapped', text: shareText, url: shareUrl });
		} catch {
			// user dismissed the sheet — nothing to do
		}
	}

	async function downloadCard() {
		cardBusy = true;
		cardError = false;
		actionStatus = 'Rendering the share card.';
		try {
			const blob = await renderShareCard({
				archetype,
				secondary,
				displayName: data.result.display_name,
				githubUsername: data.result.github_username,
				avatarUrl: data.result.avatar_url
			});

			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `developer-wrapped-${archetype.id}.png`;
			link.click();
			URL.revokeObjectURL(link.href);

			if (data.isOwner) {
				// Best effort: also host the card in Appwrite Storage for sharing.
				await fetch('/api/card', {
					method: 'POST',
					headers: { 'content-type': 'image/png' },
					body: blob
				}).catch(() => {});
			}
			actionStatus = 'Share card downloaded.';
		} catch {
			cardError = true;
			actionStatus = '';
		} finally {
			cardBusy = false;
		}
	}

	async function toggleVisibility() {
		if (!data.resultId) return;
		visibilityBusy = true;
		visibilityError = false;
		actionStatus = 'Updating result visibility.';
		const next = !isPublic;
		try {
			const res = await fetch(`/api/results/${data.resultId}`, {
				method: 'PATCH',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ is_public: next })
			});
			if (!res.ok) throw new Error(`visibility update failed (${res.status})`);
			isPublic = next;
			actionStatus = `Result is now ${next ? 'public' : 'private'}.`;
		} catch {
			visibilityError = true;
		} finally {
			visibilityBusy = false;
		}
	}
</script>

<Seo
	title="{data.result.display_name ||
		data.result.github_username ||
		'A developer'} is {archetype.name} | Developer Wrapped"
	description="{archetype.tagline} Find out what kind of developer you really are in eight uncomfortably accurate questions."
	image="/og?slug={data.result.share_slug}"
/>

<main id="main-content" class="screen shell" tabindex="-1">
	<nav class="mini-nav">
		<a href="/" class="home-link">Developer Wrapped</a>
		{#if !isPublic}
			<span class="private-chip">🔒 Private</span>
		{/if}
	</nav>

	{#if justRevealed}
		<p class="drumroll eyebrow fade-up">It's official</p>
	{/if}

	<ArchetypeCard
		{archetype}
		{secondary}
		displayName={data.result.display_name}
		githubUsername={data.result.github_username}
		avatarUrl={data.result.avatar_url}
		animate={justRevealed}
	/>

	<section class="actions" aria-label="Result actions">
		<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{actionStatus}</p>

		{#if data.isOwner && !isPublic}
			<!-- Explicit publish step: nothing becomes public without this confirmation. -->
			<div class="publish-box">
				<p class="publish-title">Your result is private</p>
				<p class="publish-copy muted">
					Only you can see this page. Publishing makes this link work for anyone and shows your
					archetype, name, and avatar on the public feed, nothing else. You can make it private
					again at any time.
				</p>
				<button
					class="btn"
					type="button"
					onclick={toggleVisibility}
					disabled={visibilityBusy}
					aria-busy={visibilityBusy}
				>
					{visibilityBusy ? 'Publishing…' : 'Publish my result'}
				</button>
			</div>
		{:else}
			<button class="btn" type="button" onclick={copyLink}>
				{copied ? 'Link copied! 🎉' : 'Copy share link'}
			</button>
			{#if copyError}
				<p class="card-error" role="alert">
					Couldn't copy the link. Copy it from the address bar.
				</p>
			{/if}
			{#if canNativeShare}
				<button class="btn btn--ghost" type="button" onclick={nativeShare}>Share…</button>
			{/if}
		{/if}

		<button
			class="btn btn--subtle"
			type="button"
			onclick={downloadCard}
			disabled={cardBusy}
			aria-busy={cardBusy}
		>
			{cardBusy ? 'Rendering card…' : 'Download share card'}
		</button>
		{#if cardError}
			<p class="card-error" role="alert">Couldn't render the card image. Try again.</p>
		{/if}

		{#if data.isOwner}
			{#if isPublic}
				<button
					class="btn btn--ghost"
					type="button"
					onclick={toggleVisibility}
					disabled={visibilityBusy}
					aria-busy={visibilityBusy}
				>
					{visibilityBusy ? 'Updating visibility…' : 'Make result private'}
				</button>
			{/if}
			<a class="btn btn--ghost" href="/quiz">Retake the quiz</a>
			{#if visibilityError}
				<p class="card-error" role="alert">Couldn't update result visibility. Try again.</p>
			{/if}
		{:else}
			<a class="btn btn--ghost" href="/">Get your own Wrapped</a>
		{/if}
	</section>

	<p class="footnote muted">
		Result stored with <a href="https://appwrite.io" rel="noreferrer">Appwrite</a>. See who else got
		wrapped on the <a href="/feed">live feed</a>.
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

	.private-chip {
		font-size: 0.8125rem;
		font-weight: 700;
		padding: 0.25rem 0.625rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--warn) 20%, var(--bg-raised));
		border: 1px solid color-mix(in srgb, var(--warn) 50%, transparent);
	}

	.drumroll {
		text-align: center;
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-error {
		font-size: 0.875rem;
		color: var(--warn);
	}

	.publish-box {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.125rem;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, var(--bg-raised));
	}

	.publish-title {
		font-weight: 800;
	}

	.publish-copy {
		font-size: 0.9075rem;
		line-height: 1.5;
	}

	.footnote {
		text-align: center;
		font-size: 0.8125rem;
	}

	.footnote a {
		color: inherit;
	}
</style>

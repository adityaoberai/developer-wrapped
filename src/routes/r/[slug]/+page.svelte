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
		console.log('[card-debug] downloadCard() called');
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
			console.log('[card-debug] blob rendered:', blob.size, 'bytes, type:', blob.type);

			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = `developer-wrapped-${archetype.id}.png`;
			link.click();
			URL.revokeObjectURL(link.href);

			console.log('[card-debug] data.isOwner =', data.isOwner);
			if (data.isOwner) {
				// Best effort: also host the card in Appwrite Storage for sharing.
				try {
					console.log('[card-debug] POSTing to /api/card…');
					const res = await fetch('/api/card', {
						method: 'POST',
						headers: { 'content-type': 'image/png' },
						body: blob
					});
					console.log('[card-debug] /api/card responded:', res.status, res.ok);
					if (!res.ok) {
						console.error('Share card upload failed:', res.status, await res.text());
					} else {
						console.log('[card-debug] upload OK:', await res.text());
					}
				} catch (cause) {
					console.error('Share card upload failed:', cause);
				}
			}
			actionStatus = 'Share card downloaded.';
		} catch (cause) {
			console.error('[card-debug] downloadCard threw before upload:', cause);
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

<main
	id="main-content"
	class="screen shell"
	style="--accent: {archetype.gradient[0]}; --accent-ink: color-mix(in srgb, {archetype
		.gradient[0]} 65%, var(--ink));"
	tabindex="-1"
>
	<nav class="mini-nav">
		<a href="/" class="home-link">Developer Wrapped</a>
		{#if !isPublic}
			<span class="private-chip">🔒 Private</span>
		{/if}
	</nav>
	<hr class="perf" aria-hidden="true" />

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
				<p class="card-error" role="alert">Couldn't copy the link. Copy it from the address bar.</p>
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

	<div class="receipt-tail" aria-hidden="true">
		<hr class="perf" />
		<span class="stamp-mark">Certified true copy</span>
		<div class="barcode"></div>
	</div>

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

	/* Header reads as a receipt masthead: mono wordmark, tear rule below. */
	.mini-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-block: 0.5rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5ch;
		min-height: 2.75rem;
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ink);
		text-decoration: none;
	}

	.home-link::before {
		content: '‹';
		color: var(--accent);
		font-weight: 700;
	}

	.home-link:hover {
		color: var(--accent-ink);
	}

	/* Privacy is the sober register — pen blue, machine-set tag. */
	.private-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.45ch;
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		white-space: nowrap;
		padding: 0.3rem 0.55rem;
		border-radius: var(--radius-sm);
		color: var(--pen);
		border: 1px solid color-mix(in srgb, var(--pen) 55%, transparent);
		background: color-mix(in srgb, var(--pen) 8%, var(--receipt));
	}

	/* The reveal moment, stamped in the archetype's accent. */
	.drumroll {
		align-self: center;
		margin-top: 0.25rem;
		padding: 0.4rem 0.85rem;
		letter-spacing: 0.24em;
		color: var(--accent-ink);
		border: 1.5px solid var(--accent);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--accent) 10%, var(--receipt));
	}

	.actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-error {
		display: flex;
		align-items: flex-start;
		gap: 0.5ch;
		font-size: 0.875rem;
		line-height: 1.45;
		color: var(--warn);
	}

	.card-error::before {
		content: '⚠';
		flex: 0 0 auto;
		font-family: var(--mono);
	}

	/* Publish confirmation is a trust document: calm pen register on receipt stock. */
	.publish-box {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem 1.125rem;
		border: 1px solid var(--rule-2);
		border-left: 3px solid var(--pen);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--pen) 6%, var(--receipt));
	}

	.publish-title {
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--pen);
	}

	.publish-copy {
		font-size: 0.9075rem;
		line-height: 1.5;
	}

	/* Decorative receipt tail: tear, certification stamp, barcode. */
	.receipt-tail {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		margin-top: 0.5rem;
	}

	.receipt-tail .stamp-mark {
		align-self: center;
	}

	.footnote {
		text-align: center;
		font-size: 0.8125rem;
		line-height: 1.5;
	}

	.footnote a {
		color: inherit;
	}
</style>

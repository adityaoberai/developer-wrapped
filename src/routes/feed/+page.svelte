<script lang="ts">
	import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT } from '$env/static/public';
	import Seo from '$lib/components/Seo.svelte';
	import { getArchetype } from '$lib/content/archetypes';
	import type { ArchetypeId, FeedItem } from '$lib/types';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Realtime prepends to the server-loaded list; local divergence is the point.
	// svelte-ignore state_referenced_locally
	let items = $state<FeedItem[]>(data.items);
	let status = $state<'connecting' | 'live' | 'offline'>('connecting');

	const statusLabel = {
		connecting: 'Connecting…',
		live: 'Live',
		offline: 'Live updates unavailable'
	} as const;

	onMount(() => {
		let destroyed = false;
		let cleanup = () => {};

		(async () => {
			try {
				// Realtime is optional flair: the feed works as a static list without it.
				const { Client, Realtime, Channel } = await import('appwrite');
				const client = new Client()
					.setEndpoint(PUBLIC_APPWRITE_ENDPOINT)
					.setProject(PUBLIC_APPWRITE_PROJECT);
				const realtime = new Realtime(client);

				realtime.onOpen(() => (status = 'live'));
				realtime.onClose(() => (status = 'offline'));
				realtime.onError(() => (status = 'offline'));

				const subscription = await realtime.subscribe(
					Channel.tablesdb('wrapped').table('public_shares').row(),
					(event) => {
						const row = event.payload as Record<string, unknown>;
						// Unpublishing (and republishing) deletes the share row — drop
						// the entry live instead of showing a dead link until reload.
						if (event.events.some((name) => name.endsWith('.delete'))) {
							const slug = (row.share_slug as string) || (row.$id as string);
							if (slug) items = items.filter((i) => i.share_slug !== slug);
							return;
						}
						if (!event.events.some((name) => name.endsWith('.create'))) return;
						let contributions: number;
						try {
							contributions = (JSON.parse(row.metrics_json as string) as { contributions: number })
								.contributions;
						} catch {
							return;
						}
						const item: FeedItem = {
							share_slug: row.share_slug as string,
							display_name: (row.display_name as string) ?? '',
							github_username: (row.github_username as string) ?? '',
							avatar_url: (row.avatar_url as string) ?? '',
							archetype_id: (row.archetype_id as ArchetypeId) || null,
							contributions,
							published_at: row.published_at as string
						};
						items = [item, ...items.filter((i) => i.share_slug !== item.share_slug)].slice(0, 30);
					}
				);
				// The component may have unmounted while subscribe() was in flight.
				if (destroyed) {
					subscription.close().catch(() => {});
					return;
				}
				status = 'live';
				cleanup = () => {
					subscription.close().catch(() => {});
				};
			} catch {
				if (!destroyed) status = 'offline';
			}
		})();

		return () => {
			destroyed = true;
			cleanup();
		};
	});

	function timeAgo(iso: string): string {
		const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
		if (seconds < 60) return 'just now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	}
</script>

<Seo
	title="Recently Wrapped — Developer Wrapped"
	description="A live feed of developers finding out what they really are. Powered by Appwrite Realtime."
/>

<main id="main-content" class="shell shell--wide page" tabindex="-1">
	<nav class="mini-nav">
		<a href="/" class="home-link">← Developer Wrapped</a>
	</nav>

	<header class="head">
		<h1>Recently Wrapped</h1>
		<p class="status" data-status={status} role="status" aria-live="polite" aria-atomic="true">
			<span class="dot" aria-hidden="true"></span>
			{statusLabel[status]}
		</p>
	</header>

	{#if items.length === 0}
		<p class="empty muted">
			Nobody has published a Wrapped yet. <a href="/">Be the first</a> — set the tone for everyone else.
		</p>
	{:else}
		<ul class="feed" aria-live="polite" aria-relevant="additions removals">
			{#each items as item (item.share_slug)}
				{@const archetype = item.archetype_id ? getArchetype(item.archetype_id) : null}
				<li class="fade-up">
					<a class="entry" href="/w/{item.share_slug}">
						{#if item.avatar_url}
							<img
								src={item.avatar_url}
								alt=""
								width="44"
								height="44"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
						{:else}
							<span class="fallback-avatar" aria-hidden="true">{archetype?.emoji ?? '📦'}</span>
						{/if}
						<div class="entry-text">
							<p>
								<strong>{item.display_name || item.github_username || 'Someone'}</strong>
								shipped {item.contributions.toLocaleString('en-US')} contributions
								{#if archetype}
									as {archetype.name} {archetype.emoji}
								{/if}
							</p>
							<p class="meta muted">
								{#if item.github_username}@{item.github_username} ·{/if}
								<time datetime={item.published_at}>{timeAgo(item.published_at)}</time>
							</p>
						</div>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<footer class="cta">
		<a class="btn" href="/">Get your own Wrapped</a>
	</footer>
</main>

<style>
	.page {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-block: 1rem 2.5rem;
	}

	.mini-nav {
		padding-block: 0.5rem;
	}

	.home-link {
		display: inline-flex;
		align-items: center;
		min-height: 2.75rem;
		font-weight: 700;
		font-size: 0.9375rem;
		color: var(--muted);
		text-decoration: none;
	}

	.home-link:hover {
		color: var(--fg);
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	h1 {
		font-size: clamp(1.75rem, 6vw, 2.5rem);
		font-weight: 900;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 700;
		padding: 0.375rem 0.75rem;
		border-radius: 999px;
		border: 1px solid var(--border-dim);
		background: var(--bg-raised);
	}

	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--muted);
	}

	.status[data-status='live'] .dot {
		background: var(--success);
		animation: pulse-soft 1.6s ease-in-out infinite;
	}

	.status[data-status='offline'] .dot {
		background: var(--warn);
	}

	.feed {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		list-style: none;
		padding: 0;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 0.875rem;
		padding: 0.875rem 1rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--border-dim);
		background: var(--bg-raised);
		color: var(--fg);
		text-decoration: none;
		transition: border-color 120ms ease;
	}

	.entry:hover {
		border-color: rgba(167, 139, 250, 0.6);
	}

	.entry img,
	.fallback-avatar {
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.fallback-avatar {
		display: grid;
		place-items: center;
		background: var(--bg);
		font-size: 1.25rem;
	}

	.entry-text {
		min-width: 0;
	}

	.entry-text p {
		line-height: 1.35;
		overflow-wrap: anywhere;
	}

	.meta {
		font-size: 0.8125rem;
	}

	.empty {
		padding: 2.5rem 0;
		text-align: center;
	}

	.cta {
		margin-top: auto;
		padding-top: 1.5rem;
	}
</style>

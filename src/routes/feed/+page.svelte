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
		<div class="head-title">
			<p class="eyebrow">Live ledger</p>
			<h1>Recently Wrapped</h1>
		</div>
		<p class="status" data-status={status} role="status" aria-live="polite" aria-atomic="true">
			<span class="dot" aria-hidden="true"></span>
			{statusLabel[status]}
		</p>
	</header>

	<div class="source-stamp feed-source">
		<span class="tag">SOURCE</span>
		<span class="val">channel=<b>public_shares</b> · realtime · newest first</span>
	</div>

	<hr class="perf" />

	{#if items.length === 0}
		<div class="empty">
			<span class="stamp-mark">Awaiting first entry</span>
			<p class="empty-copy muted">
				Nobody has published a Wrapped yet. <a href="/">Be the first</a> — set the tone for everyone else.
			</p>
		</div>
	{:else}
		<ul class="feed" aria-live="polite" aria-relevant="additions removals">
			{#each items as item (item.share_slug)}
				{@const archetype = item.archetype_id ? getArchetype(item.archetype_id) : null}
				<li class="fade-up">
					<a
						class="entry"
						href="/w/{item.share_slug}"
						style:--accent={archetype ? archetype.gradient[0] : null}
						style:--accent-ink={archetype
							? `color-mix(in srgb, ${archetype.gradient[0]} 65%, var(--ink))`
							: null}
					>
						{#if item.avatar_url}
							<img
								class="avatar"
								src={item.avatar_url}
								alt=""
								width="44"
								height="44"
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
						{:else}
							<span class="avatar fallback-avatar" aria-hidden="true"
								>{archetype?.emoji ?? '📦'}</span
							>
						{/if}
						<div class="entry-text">
							<div class="entry-head">
								<strong class="name"
									>{item.display_name || item.github_username || 'Someone'}</strong
								>
							</div>
							<p class="line">
								shipped <span class="count">{item.contributions.toLocaleString('en-US')}</span>
								contributions
								{#if archetype}
									as <span class="arch">{archetype.name} {archetype.emoji}</span>
								{/if}
							</p>
							<p class="meta muted">
								{#if item.github_username}@{item.github_username} ·{/if}
								<time datetime={item.published_at}>{timeAgo(item.published_at)}</time>
							</p>
						</div>
						<span class="chev" aria-hidden="true">›</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<hr class="perf" />

	<footer class="cta">
		<a class="btn" href="/">Get your own Wrapped</a>
		<p class="footnote">Printed live · zero mercy · GitHub has testified</p>
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
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--muted);
		text-decoration: none;
	}

	.home-link:hover {
		color: var(--ink);
	}

	/* --- masthead ------------------------------------------------ */
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.head-title .eyebrow {
		margin-bottom: 0.4rem;
	}

	h1 {
		font-size: clamp(1.75rem, 6vw, 2.5rem);
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}

	/* connecting / live / offline — a terminal status readout */
	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		padding: 0.45rem 0.7rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--ink);
		background: var(--receipt);
		color: var(--ink);
		box-shadow: var(--shadow-hard) var(--rule-2);
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

	/* the hero device — documents the machine feed source */
	.feed-source {
		border-radius: var(--radius-sm);
	}

	/* --- the ledger of receipts ---------------------------------- */
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
		border: 1px solid var(--rule);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-md);
		background: var(--receipt);
		color: var(--ink);
		text-decoration: none;
		box-shadow: var(--shadow-card);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.entry:hover {
		transform: translate(-1px, -1px);
		box-shadow: 5px 6px 0 color-mix(in srgb, var(--accent) 24%, var(--rule-2));
	}

	.avatar {
		width: 2.75rem;
		height: 2.75rem;
		flex-shrink: 0;
		border-radius: 50%;
		border: 2px solid var(--ink);
		box-shadow:
			0 0 0 2px var(--receipt),
			0 0 0 3px var(--accent);
	}

	.fallback-avatar {
		display: grid;
		place-items: center;
		background: var(--band);
		font-size: 1.25rem;
	}

	.entry-text {
		flex: 1 1 auto;
		min-width: 0;
	}

	.entry-head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.name {
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.9375rem;
		letter-spacing: 0.01em;
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	.line {
		margin-top: 0.15rem;
		font-size: 0.875rem;
		line-height: 1.35;
		color: var(--ink-2);
		overflow-wrap: anywhere;
	}

	.count {
		font-family: var(--mono);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--accent-ink);
	}

	.arch {
		font-family: var(--mono);
		font-weight: 700;
		color: var(--accent-ink);
	}

	.meta {
		margin-top: 0.25rem;
		font-family: var(--mono);
		font-size: 0.75rem;
		letter-spacing: 0.02em;
	}

	.meta time {
		font-variant-numeric: tabular-nums;
	}

	.chev {
		flex-shrink: 0;
		align-self: center;
		font-family: var(--mono);
		font-weight: 700;
		font-size: 1.25rem;
		line-height: 1;
		color: var(--accent);
	}

	/* --- empty ledger -------------------------------------------- */
	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2.75rem 1.25rem;
		text-align: center;
		border: 1px dashed var(--rule);
		border-radius: var(--radius-lg);
		background: var(--receipt);
	}

	.empty-copy {
		max-width: 34ch;
		line-height: 1.55;
	}

	/* --- footer -------------------------------------------------- */
	.cta {
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-top: 0.5rem;
	}

	.footnote {
		text-align: center;
		font-family: var(--mono);
		font-size: 0.6875rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
	}
</style>

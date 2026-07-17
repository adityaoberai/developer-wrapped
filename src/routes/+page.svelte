<script lang="ts">
	import { PUBLIC_APPWRITE_ENDPOINT, PUBLIC_APPWRITE_PROJECT } from '$env/static/public';
	import GithubButton from '$lib/components/GithubButton.svelte';
	import Seo from '$lib/components/Seo.svelte';
	import { getArchetype } from '$lib/content/archetypes';
	import type { ArchetypeId, FeedItem } from '$lib/types';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// The live ledger seeds from the server load, then Realtime prepends new
	// publishes; local divergence is the point.
	// svelte-ignore state_referenced_locally
	let items = $state<FeedItem[]>(data.recentlyWrapped);
	let status = $state<'connecting' | 'live' | 'offline'>('connecting');

	const statusLabel = {
		connecting: 'Connecting',
		live: 'Live',
		offline: 'Offline'
	} as const;

	const FEED_CAP = 6;

	onMount(() => {
		let destroyed = false;
		let cleanup = () => {};

		(async () => {
			try {
				// Realtime is optional flair: the ledger works as a static list without it.
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
						// Unpublishing (and republishing) deletes the share row — drop the
						// entry live instead of showing a dead link until reload.
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
						items = [item, ...items.filter((i) => i.share_slug !== item.share_slug)].slice(
							0,
							FEED_CAP
						);
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
	title="Developer Wrapped: What kind of developer are you, really?"
	description="Your last 12 months on GitHub, turned into an uncomfortably accurate story. Sign in with GitHub, see the evidence, get roasted, share the damage."
/>

<main id="main-content" class="screen shell" tabindex="-1">
	<article class="receipt fade-up">
		<div class="statusbar" aria-hidden="true">
			<span>DEVELOPER-WRAPPED</span>
			<span class="live">REC</span>
		</div>

		<div class="receipt__body">
			<div class="merchant">
				<p class="now-printing" aria-hidden="true">— NOW PRINTING —</p>
				<p class="wordmark"><span>DEVELOPER</span><span>WRAPPED</span></p>
				<p class="meta" aria-hidden="true">
					<span>RECEIPT&nbsp;<b>#DW-2026</b></span>
					<span>·</span>
					<span>REG&nbsp;04</span>
					<span>·</span>
					<span>READ-ONLY</span>
				</p>
			</div>

			<hr class="perf" />

			<header class="hero">
				<p class="eyebrow">Developer Wrapped</p>
				<h1>
					What kind of developer are you, <em>really?</em><span class="caret" aria-hidden="true"
					></span>
				</h1>
				<p class="sub">
					Your last 12 months on GitHub, turned into a story <span class="hi">with receipts</span>,
					plus eight uncomfortably accurate questions, if you dare.
				</p>
			</header>

			<div class="cta">
				{#if data.signedIn}
					<a class="btn" href="/welcome">Continue as {data.name || 'you'}</a>
				{:else}
					<GithubButton />
				{/if}
				<p class="consent">
					Read-only profile access · aggregate counts, never your code · private until you publish.
				</p>
				<div class="links">
					<a href="/archetypes">Browse the archetypes</a>
				</div>
			</div>

			<hr class="rule-line" />

			<section class="ledger" aria-label="Recently wrapped">
				<div class="ledger-head">
					<p class="eyebrow">Recently wrapped</p>
					<p
						class="status"
						data-status={status}
						role="status"
						aria-live="polite"
						aria-atomic="true"
					>
						<span class="dot" aria-hidden="true"></span>
						{statusLabel[status]}
					</p>
				</div>

				{#if items.length === 0}
					<p class="ledger-empty muted">
						No one has published a Wrapped yet. Be the first — set the tone for everyone else.
					</p>
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
											width="40"
											height="40"
											loading="lazy"
											referrerpolicy="no-referrer"
										/>
									{:else}
										<span class="avatar fallback-avatar" aria-hidden="true"
											>{archetype?.emoji ?? '📦'}</span
										>
									{/if}
									<div class="entry-text">
										<p class="line">
											<strong class="name"
												>{item.display_name || item.github_username || 'Someone'}</strong
											>
											— <span class="count">{item.contributions.toLocaleString('en-US')}</span>
											contributions{#if archetype}, <span class="arch">{archetype.name}</span>{/if}
										</p>
										<p class="entry-meta muted">
											{#if item.github_username}@{item.github_username} ·{/if}
											<time datetime={item.published_at}>{timeAgo(item.published_at)}</time>
										</p>
									</div>
									<span class="chev" aria-hidden="true">›</span>
								</a>
							</li>
						{/each}
					</ul>
					<a class="ledger-all" href="/feed">See the full ledger ›</a>
				{/if}
			</section>

			<hr class="perf" />
		</div>
	</article>
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding-block: 2.5rem 2rem;
	}

	/* the printed receipt, sitting on the paper desk */
	.receipt {
		margin-block: auto;
		width: 100%;
		background: var(--receipt);
		border: 1.5px solid var(--ink);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		overflow: hidden;
	}

	/* terminal title / status bar */
	.statusbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		background: var(--ink);
		color: var(--receipt);
		padding: 0.5rem 0.9rem;
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.statusbar .live {
		display: inline-flex;
		align-items: center;
		gap: 0.5ch;
		color: var(--paper);
	}

	.statusbar .live::before {
		content: '●';
		color: var(--stamp);
		font-size: 0.9em;
		animation: pulse-soft 1.6s ease-in-out infinite;
	}

	.receipt__body {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding: 1.5rem 1.375rem 1.75rem;
		text-align: center;
	}

	/* centered merchant header — the wordmark */
	.merchant {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.now-printing {
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.wordmark {
		font-family: var(--mono);
		font-weight: 700;
		font-size: clamp(1.5rem, 8vw, 2rem);
		line-height: 0.98;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink);
	}

	.wordmark span {
		display: block;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem 0.6ch;
		font-family: var(--mono);
		font-size: 0.625rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.meta b {
		color: var(--ink);
		font-weight: 700;
	}

	/* headline */
	.hero {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.hero .eyebrow {
		align-self: center;
	}

	.hero h1 {
		font-size: clamp(1.9rem, 7.5vw, 2.6rem);
		letter-spacing: -0.02em;
	}

	/* solid stamp emphasis — this is a paper world, no gradient text */
	.hero em {
		font-style: normal;
		color: var(--stamp-ink);
	}

	.sub {
		font-family: var(--sans);
		font-size: 1.0625rem;
		line-height: 1.55;
		color: var(--ink-2);
		max-width: 34ch;
		margin-inline: auto;
	}

	.sub .hi {
		color: var(--stamp-ink);
		font-weight: 700;
	}

	/* call to action */
	.cta {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	/* one-line sober-register consent note under the sign-in button */
	.consent {
		font-family: var(--sans);
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--pen);
		max-width: 34ch;
		margin-inline: auto;
	}

	.links {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.75ch;
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.links a {
		display: inline-flex;
		align-items: center;
		gap: 0.5ch;
		min-height: 2.75rem;
		color: var(--ink);
		text-decoration: none;
	}

	.links a::before {
		content: '›';
		color: var(--accent);
		font-weight: 700;
	}

	.links a:hover {
		color: var(--stamp-ink);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	/* --- the live ledger ---------------------------------------- */
	.ledger {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		text-align: left;
	}

	.ledger-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	/* connecting / live / offline — a compact terminal readout */
	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		padding: 0.3rem 0.55rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--rule);
		background: var(--paper);
		color: var(--muted);
	}

	.dot {
		width: 0.45rem;
		height: 0.45rem;
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
		gap: 0.5rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.entry {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--rule);
		border-left: 3px solid var(--accent);
		border-radius: var(--radius-md);
		background: var(--receipt);
		color: var(--ink);
		text-decoration: none;
		box-shadow: var(--shadow-hard) var(--rule-2);
		transition:
			transform 120ms ease,
			box-shadow 120ms ease;
	}

	.entry:hover {
		transform: translate(-1px, -1px);
		box-shadow: 5px 5px 0 color-mix(in srgb, var(--accent) 24%, var(--rule-2));
	}

	.avatar {
		width: 2.25rem;
		height: 2.25rem;
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
		font-size: 1.05rem;
	}

	.entry-text {
		flex: 1 1 auto;
		min-width: 0;
	}

	.line {
		font-size: 0.8125rem;
		line-height: 1.35;
		color: var(--ink-2);
		overflow-wrap: anywhere;
	}

	.name {
		font-family: var(--mono);
		font-weight: 700;
		font-size: 0.8125rem;
		letter-spacing: 0.01em;
		color: var(--ink);
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

	.entry-meta {
		margin-top: 0.2rem;
		font-family: var(--mono);
		font-size: 0.6875rem;
		letter-spacing: 0.02em;
	}

	.entry-meta time {
		font-variant-numeric: tabular-nums;
	}

	.chev {
		flex-shrink: 0;
		align-self: center;
		font-family: var(--mono);
		font-weight: 700;
		font-size: 1.15rem;
		line-height: 1;
		color: var(--accent);
	}

	.ledger-empty {
		font-size: 0.875rem;
		line-height: 1.55;
		padding: 0.5rem 0;
	}

	.ledger-all {
		align-self: flex-start;
		min-height: 2.75rem;
		display: inline-flex;
		align-items: center;
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--stamp-ink);
		text-decoration: none;
	}

	.ledger-all:hover {
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	@media (min-width: 48rem) {
		.receipt__body {
			padding: 1.75rem 1.75rem 2rem;
			gap: 1.4rem;
		}
	}
</style>

<script lang="ts">
	import type { Archetype } from '$lib/types';

	let {
		archetype,
		secondary,
		displayName,
		githubUsername,
		avatarUrl,
		animate = false
	}: {
		archetype: Archetype;
		secondary: Archetype;
		displayName: string;
		githubUsername: string;
		avatarUrl: string;
		animate?: boolean;
	} = $props();
</script>

<article
	class="result-card"
	class:pop-in={animate}
	aria-labelledby="result-heading"
	style:--accent={archetype.gradient[0]}
	style:--accent-ink="color-mix(in srgb, {archetype.gradient[0]} 65%, var(--ink))"
>
	<div class="verdict-head">
		<p class="eyebrow">The verdict</p>
		<span class="stamp-mark" class:stamp-in={animate} aria-hidden="true">Certified · Exhibit A</span
		>
	</div>

	<hr class="perf" />

	<header class="who">
		{#if avatarUrl}
			<img src={avatarUrl} alt="" width="48" height="48" referrerpolicy="no-referrer" />
		{/if}
		<div>
			<p class="name">{displayName || githubUsername || 'Mystery Developer'}</p>
			{#if githubUsername}
				<p class="handle">@{githubUsername}</p>
			{/if}
		</div>
		<span class="brand" aria-hidden="true">Developer<br />Wrapped</span>
	</header>

	<hr class="rule-line" />

	<div class="verdict">
		<span class="emoji" aria-hidden="true">{archetype.emoji}</span>
		<h1 id="result-heading">{archetype.name}</h1>
		<p class="tagline">“{archetype.tagline}”</p>
	</div>

	<p class="roast">{archetype.roast}</p>

	<ul class="traits">
		{#each archetype.traits as trait (trait)}
			<li>{trait}</li>
		{/each}
	</ul>

	<hr class="rule-line" />

	<footer class="secondary">
		<span class="sec-label">With a side of</span>
		<span class="sec-val"
			><span aria-hidden="true">{secondary.emoji}</span>
			{secondary.name.replace(/^The /, 'the ')}</span
		>
	</footer>

	<div class="source-stamp">
		<span class="tag">SOURCE</span>
		<span class="val">archetype=<b>{archetype.id}</b></span>
	</div>
</article>

<style>
	/* The shared verdict "ticket": a receipt printed on thermal stock,
	   framed in ink with a hard offset shadow so it screenshots well. */
	.result-card {
		position: relative;
		border-radius: var(--radius-lg);
		border: 1.5px solid var(--ink);
		padding: 1.375rem 1.375rem 1.5rem;
		background:
			repeating-linear-gradient(90deg, rgba(27, 23, 18, 0.014) 0 1px, transparent 1px 3px),
			var(--receipt);
		box-shadow: var(--shadow-hard) var(--accent);
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}

	/* verdict header: kicker on the left, rubber stamp cocked on the right */
	.verdict-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.verdict-head .eyebrow {
		margin: 0;
	}

	.stamp-in {
		animation: stamp-in 480ms ease both;
	}

	.perf,
	.rule-line {
		margin: 0;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.who > div {
		flex: 1;
		min-width: 0;
	}

	.name,
	.handle {
		overflow-wrap: anywhere;
	}

	/* notary-ring avatar frame */
	.who img {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: 2px solid var(--ink);
		box-shadow: 0 0 0 2px var(--receipt);
		background: var(--receipt);
	}

	.name {
		font-family: var(--mono);
		font-weight: 700;
		line-height: 1.2;
		letter-spacing: 0.01em;
	}

	.handle {
		font-family: var(--mono);
		font-size: 0.8125rem;
		color: var(--muted);
		letter-spacing: 0.02em;
	}

	.brand {
		margin-left: auto;
		text-align: right;
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 1.15;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		color: var(--muted);
	}

	.verdict {
		text-align: center;
		padding-block: 0.25rem;
	}

	.emoji {
		display: block;
		font-size: 3.5rem;
		line-height: 1.1;
	}

	/* archetype name = the machine verdict (mono via global h1) */
	.verdict h1 {
		font-size: clamp(1.75rem, 7.5vw, 2.375rem);
		font-weight: 700;
		letter-spacing: -0.02em;
		margin-top: 0.375rem;
		color: var(--accent-ink);
	}

	/* tagline = long-form, quoted, read in the sans register */
	.tagline {
		font-family: var(--sans);
		margin-top: 0.5rem;
		font-weight: 600;
		color: var(--muted);
		text-wrap: balance;
	}

	/* the roast = long-form body copy */
	.roast {
		font-family: var(--sans);
		font-size: 0.9375rem;
		line-height: 1.6;
		color: var(--ink-2);
	}

	/* traits printed as ledger/evidence rows */
	.traits {
		display: flex;
		flex-direction: column;
		list-style: none;
		padding: 0;
		border-top: 1px solid var(--rule-2);
	}

	.traits li {
		display: flex;
		align-items: baseline;
		gap: 0.6ch;
		padding: 0.5rem 0.125rem;
		border-bottom: 1px solid var(--rule-2);
		font-family: var(--mono);
		font-size: 0.875rem;
		line-height: 1.4;
		color: var(--ink);
	}

	.traits li::before {
		content: '▸';
		flex: 0 0 auto;
		color: var(--accent);
		font-weight: 700;
	}

	/* "with a side of…" secondary verdict, as a ledger dot-leader row */
	.secondary {
		display: flex;
		align-items: baseline;
		gap: 0.75ch;
		font-family: var(--mono);
		font-size: 0.8125rem;
	}

	.sec-label {
		white-space: nowrap;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		font-weight: 700;
		color: var(--muted);
	}

	.sec-val {
		flex: 1;
		text-align: right;
		font-weight: 700;
		color: var(--accent-ink);
		overflow-wrap: anywhere;
	}
</style>

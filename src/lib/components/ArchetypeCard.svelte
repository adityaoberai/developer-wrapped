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
	style:--card-a={archetype.gradient[0]}
	style:--card-b={archetype.gradient[1]}
>
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
		<span class="brand" aria-hidden="true">Developer Wrapped</span>
	</header>

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

	<footer class="secondary">
		<span aria-hidden="true">{secondary.emoji}</span>
		with a suspicious side of {secondary.name.replace(/^The /, 'the ')}
	</footer>
</article>

<style>
	.result-card {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border-dim);
		padding: 1.375rem;
		background:
			radial-gradient(
				30rem 20rem at 85% -15%,
				color-mix(in srgb, var(--card-a) 55%, transparent),
				transparent 65%
			),
			radial-gradient(
				24rem 18rem at -10% 110%,
				color-mix(in srgb, var(--card-b) 40%, transparent),
				transparent 60%
			),
			var(--bg-raised);
		display: flex;
		flex-direction: column;
		gap: 1.125rem;
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.who img {
		width: 3rem;
		height: 3rem;
		border-radius: 50%;
		border: 2px solid rgba(248, 250, 252, 0.55);
	}

	.name {
		font-weight: 700;
		line-height: 1.2;
	}

	.handle {
		font-size: 0.875rem;
		color: var(--muted);
	}

	.brand {
		margin-left: auto;
		font-size: 0.6875rem;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--muted);
	}

	.verdict {
		text-align: center;
		padding-block: 0.5rem;
	}

	.emoji {
		display: block;
		font-size: 3.5rem;
		line-height: 1.1;
	}

	.verdict h1 {
		font-size: clamp(1.875rem, 8vw, 2.5rem);
		font-weight: 900;
		letter-spacing: -0.03em;
		margin-top: 0.375rem;
	}

	.tagline {
		margin-top: 0.5rem;
		font-weight: 600;
		color: color-mix(in srgb, var(--fg) 88%, var(--card-a));
	}

	.roast {
		font-size: 0.9875rem;
		line-height: 1.55;
		color: #cbd5e1;
	}

	.traits {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		list-style: none;
		padding: 0;
	}

	.traits li {
		padding: 0.625rem 0.875rem;
		border-radius: 10px;
		background: rgba(15, 23, 42, 0.55);
		border: 1px solid var(--border-dim);
		font-size: 0.9rem;
		font-weight: 600;
	}

	.traits li::before {
		content: '▸ ';
		color: var(--accent-bright);
	}

	.secondary {
		font-size: 0.875rem;
		color: var(--muted);
		font-weight: 600;
		text-align: center;
	}
</style>

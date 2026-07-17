<script lang="ts">
	import { archetypes } from '$lib/content/archetypes';
</script>

<ul class="teaser" aria-label="The eight developer archetypes">
	{#each archetypes as archetype (archetype.id)}
		<li class="chip">
			<span class="emoji" aria-hidden="true">{archetype.emoji}</span>
			<span class="name">{archetype.name.replace(/^The /, '')}</span>
		</li>
	{/each}
</ul>

<style>
	.teaser {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	/* Small mono ticket/label tags punched onto receipt stock. */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5ch;
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--rule);
		border-radius: var(--radius-sm);
		background: var(--receipt);
		box-shadow: 2px 2px 0 var(--rule-2);
		font-family: var(--mono);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
		white-space: nowrap;
	}

	.emoji {
		font-size: 0.875rem;
		line-height: 1;
		filter: grayscale(0.15);
	}

	/* faint tear/perforation cue on the leading edge of each ticket */
	.chip::before {
		content: '';
		align-self: stretch;
		width: 0;
		margin-right: 0.15ch;
		border-left: 1px dotted var(--rule);
	}
</style>

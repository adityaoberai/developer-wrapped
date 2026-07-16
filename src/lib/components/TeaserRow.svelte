<script lang="ts">
	import { archetypes } from '$lib/content/archetypes';
</script>

<ul class="teaser" aria-label="The eight developer archetypes">
	{#each archetypes as archetype (archetype.id)}
		<li class="chip">
			<span aria-hidden="true">{archetype.emoji}</span>
			{archetype.name.replace(/^The /, '')}
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

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid var(--border-dim);
		border-radius: 999px;
		background: var(--bg-raised);
		font-size: 0.8125rem;
		font-weight: 600;
		color: var(--fg);
		white-space: nowrap;
	}
</style>

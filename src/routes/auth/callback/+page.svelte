<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
</script>

<Seo
	title="Sign-in failed - Developer Wrapped"
	description="GitHub sign-in could not be completed for Developer Wrapped."
	noindex
/>

<main id="main-content" class="screen shell" tabindex="-1">
	<div class="card error-card fade-up" role="alert">
		<span class="emoji" aria-hidden="true">🙈</span>
		<h1>Sign-in didn't stick</h1>
		<p class="muted">
			GitHub and we had a small misunderstanding. No answers were harmed - give it another go.
		</p>
		<a class="btn" href="/auth/login" data-sveltekit-preload-data="off" data-sveltekit-reload
			>Retry sign-in</a
		>
		<a class="btn btn--ghost" href="/">Back home</a>
	</div>
</main>

<style>
	.screen {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding-block: 2rem;
	}

	.error-card {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		width: 100%;
		padding: 2rem 1.5rem;
		text-align: center;
		align-items: center;
	}

	.error-card h1 {
		font-size: 1.625rem;
		font-weight: 800;
	}

	.emoji {
		font-size: 2.5rem;
	}
</style>

<script lang="ts">
	import Seo from '$lib/components/Seo.svelte';
</script>

<Seo
	title="Sign-in failed - Developer Wrapped"
	description="GitHub sign-in could not be completed for Developer Wrapped."
	noindex
/>

<main id="main-content" class="screen shell" tabindex="-1">
	<div class="slip fade-up" role="alert">
		<div class="slip__bar" aria-hidden="true">
			<span>Reg 04 · Auth</span>
			<span class="slip__status">Declined</span>
		</div>

		<div class="slip__body">
			<div class="slip__head">
				<p class="eyebrow">Authorization</p>
				<span class="stamp-mark slip__stamp" aria-hidden="true">Void · no entry</span>
			</div>

			<span class="emoji" aria-hidden="true">🙈</span>
			<h1>Sign-in didn't stick</h1>
			<p class="muted">
				GitHub and we had a small misunderstanding. No answers were harmed - give it another go.
			</p>

			<div class="source-stamp" aria-hidden="true">
				<span class="tag">SOURCE</span>
				<span class="val">oauth_callback=<b>failed</b></span>
			</div>

			<div class="slip__actions">
				<a class="btn" href="/auth/login" data-sveltekit-preload-data="off" data-sveltekit-reload
					>Retry sign-in</a
				>
				<a class="btn btn--ghost" href="/">Back home</a>
			</div>
		</div>

		<hr class="perf" />

		<div class="slip__foot" aria-hidden="true">
			<span>No answers harmed</span>
			<span>DW-AUTH</span>
		</div>

		<div class="barcode" aria-hidden="true"></div>
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

	/* A "declined" receipt slip: the auth transaction that didn't clear. */
	.slip {
		position: relative;
		width: 100%;
		background: var(--receipt);
		border: 1.5px solid var(--ink);
		border-radius: var(--radius-lg);
		box-shadow: var(--shadow-card);
		overflow: hidden;
	}

	.slip__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.5rem 0.875rem;
		background: var(--ink);
		color: var(--receipt);
		font-family: var(--mono);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
	}

	.slip__status {
		display: inline-flex;
		align-items: center;
		gap: 0.5ch;
		color: var(--paper);
	}

	.slip__status::before {
		content: '';
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--stamp);
	}

	.slip__body {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 1.375rem 1.375rem 1.5rem;
	}

	.slip__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.slip__stamp {
		flex: 0 0 auto;
		animation: stamp-in 360ms ease both;
	}

	.emoji {
		font-size: 2.25rem;
		line-height: 1;
	}

	.slip h1 {
		font-size: 1.625rem;
	}

	/* Long-form reading stays sans (set globally on body); size it up for clarity. */
	.slip__body .muted {
		font-size: 0.9375rem;
		line-height: 1.55;
	}

	.slip__actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-top: 0.25rem;
	}

	.slip__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.625rem 1.375rem 0.5rem;
		font-family: var(--mono);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--muted);
	}

	.slip .barcode {
		width: auto;
		height: 30px;
		margin: 0 1.375rem 1.25rem;
		opacity: 0.85;
	}
</style>

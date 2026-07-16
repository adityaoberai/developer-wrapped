<script lang="ts">
	import { page } from '$app/state';

	let {
		title,
		description,
		image = '/og',
		imageAlt = 'Developer Wrapped preview',
		noindex = false
	}: {
		title: string;
		description: string;
		image?: string;
		imageAlt?: string;
		noindex?: boolean;
	} = $props();

	const canonical = $derived(page.url.origin + page.url.pathname);
	const imageUrl = $derived(image.startsWith('http') ? image : page.url.origin + image);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={description} />
	<link rel="canonical" href={canonical} />
	<meta
		name="robots"
		content={noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}
	/>
	<meta property="og:type" content="website" />
	<meta property="og:locale" content="en_US" />
	<meta property="og:site_name" content="Developer Wrapped" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={imageUrl} />
	<meta property="og:image:type" content="image/png" />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={imageAlt} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={imageUrl} />
	<meta name="twitter:image:alt" content={imageAlt} />
</svelte:head>

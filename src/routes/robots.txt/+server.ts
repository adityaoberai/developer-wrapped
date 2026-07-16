import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const body = [
		'User-agent: *',
		'Allow: /',
		'Disallow: /api/',
		'Disallow: /auth/',
		'',
		`Sitemap: ${url.origin}/sitemap.xml`,
		''
	].join('\n');

	return new Response(body, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
			vary: 'Host'
		}
	});
};

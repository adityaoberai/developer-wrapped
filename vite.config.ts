import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'script-src': ['self'],
					'style-src': ['self', 'unsafe-inline'],
					'img-src': ['self', 'data:', 'blob:', 'https:'],
					'font-src': ['self', 'data:'],
					'connect-src': ['self', 'https:', 'wss:'],
					'worker-src': ['self', 'blob:'],
					'base-uri': ['none'],
					'form-action': ['self'],
					'frame-ancestors': ['none'],
					'object-src': ['none']
				}
			},

			// Appwrite Sites serves SvelteKit SSR via the Node adapter (build output: ./build).
			adapter: adapter({ precompress: true })
		})
	]
});

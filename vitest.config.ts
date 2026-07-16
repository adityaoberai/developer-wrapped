import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Pure-module tests only ($lib/wrapped); no SvelteKit runtime needed.
export default defineConfig({
	resolve: {
		alias: { $lib: path.resolve(import.meta.dirname, 'src/lib') }
	},
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});

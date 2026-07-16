import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Apple touch icons must be opaque; this mirrors the SVG favicon on a solid background.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<defs>
		<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
			<stop offset="0" stop-color="#7C3AED" />
			<stop offset="1" stop-color="#DB2777" />
		</linearGradient>
	</defs>
	<rect width="64" height="64" fill="#0F172A" />
	<rect x="10" y="10" width="44" height="44" rx="10" fill="url(#g)" />
	<rect x="29" y="10" width="6" height="44" fill="#0F172A" opacity="0.85" />
	<rect x="10" y="29" width="44" height="6" fill="#0F172A" opacity="0.85" />
	<circle cx="32" cy="32" r="6.5" fill="#F8FAFC" />
</svg>`;

const png = new Resvg(icon, { fitTo: { mode: 'width', value: 180 } }).render().asPng();
const target = fileURLToPath(new URL('../static/apple-touch-icon.png', import.meta.url));
writeFileSync(target, png);
console.log(`Wrote ${target} (${png.length} bytes)`);

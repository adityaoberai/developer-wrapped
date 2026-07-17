import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Apple touch icons must be opaque, so this mirrors the SVG favicon (a printed
// receipt with a torn bottom edge) on a solid ink background — no rounded
// corners, since iOS applies its own mask.
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
	<rect width="64" height="64" fill="#1B1712" />
	<path
		d="M15 13 H49 V45 L46.57 49.5 L44.14 45 L41.71 49.5 L39.29 45 L36.86 49.5 L34.43 45 L32 49.5 L29.57 45 L27.14 49.5 L24.71 45 L22.29 49.5 L19.86 45 L17.43 49.5 L15 45 Z"
		fill="#FBF9F3"
	/>
	<rect x="19" y="18" width="26" height="4.5" fill="#B23016" />
	<rect x="19" y="27" width="26" height="3" rx="1" fill="#1B1712" />
	<rect x="19" y="32.5" width="19" height="3" rx="1" fill="#1B1712" />
	<rect x="19" y="38" width="12" height="3" rx="1" fill="#B23016" />
</svg>`;

const png = new Resvg(icon, { fitTo: { mode: 'width', value: 180 } }).render().asPng();
const target = fileURLToPath(new URL('../static/apple-touch-icon.png', import.meta.url));
writeFileSync(target, png);
console.log(`Wrote ${target} (${png.length} bytes)`);

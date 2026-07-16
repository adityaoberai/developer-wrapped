import type { Archetype } from '$lib/types';

export interface ShareCardInput {
	archetype: Archetype;
	secondary: Archetype;
	displayName: string;
	githubUsername: string;
	avatarUrl: string;
}

const W = 1080;
const H = 1350;

/**
 * Draw the share card on an offscreen canvas and return it as a PNG blob.
 * Pure client-side rendering — works even when Storage upload is unavailable.
 */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas is not supported in this browser.');

	await document.fonts.ready;
	const [a, b] = input.archetype.gradient;

	// Background
	ctx.fillStyle = '#0f172a';
	ctx.fillRect(0, 0, W, H);
	paintGlow(ctx, W * 0.85, -80, 620, a, 0.55);
	paintGlow(ctx, W * 0.05, H + 60, 560, b, 0.4);

	// Card frame
	ctx.strokeStyle = 'rgba(226, 232, 240, 0.18)';
	ctx.lineWidth = 3;
	roundedRect(ctx, 42, 42, W - 84, H - 84, 44);
	ctx.stroke();

	ctx.textAlign = 'center';
	ctx.fillStyle = '#a78bfa';
	ctx.font = `800 34px ${fontStack()}`;
	ctx.fillText('D E V E L O P E R   W R A P P E D', W / 2, 150);

	// Avatar
	const avatar = input.avatarUrl ? await loadImage(input.avatarUrl) : null;
	if (avatar) {
		ctx.save();
		ctx.beginPath();
		ctx.arc(W / 2, 300, 92, 0, Math.PI * 2);
		ctx.closePath();
		ctx.clip();
		ctx.drawImage(avatar, W / 2 - 92, 300 - 92, 184, 184);
		ctx.restore();
		ctx.beginPath();
		ctx.arc(W / 2, 300, 92, 0, Math.PI * 2);
		ctx.strokeStyle = a;
		ctx.lineWidth = 6;
		ctx.stroke();
	}

	ctx.fillStyle = '#f8fafc';
	ctx.font = `700 44px ${fontStack()}`;
	ctx.fillText(input.displayName || input.githubUsername || 'Mystery Developer', W / 2, 460);
	if (input.githubUsername) {
		ctx.fillStyle = '#94a3b8';
		ctx.font = `600 32px ${fontStack()}`;
		ctx.fillText(`@${input.githubUsername}`, W / 2, 508);
	}

	// Verdict
	ctx.font = '120px serif';
	ctx.fillText(input.archetype.emoji, W / 2, 660);

	const gradient = ctx.createLinearGradient(140, 0, W - 140, 0);
	gradient.addColorStop(0, lighten(a));
	gradient.addColorStop(1, lighten(b));
	ctx.fillStyle = gradient;
	ctx.font = `900 84px ${fontStack()}`;
	wrapText(ctx, input.archetype.name, W / 2, 780, W - 220, 92);

	ctx.fillStyle = '#e2e8f0';
	ctx.font = `600 38px ${fontStack()}`;
	wrapText(ctx, `“${input.archetype.tagline}”`, W / 2, 950, W - 240, 52);

	// Traits
	ctx.textAlign = 'left';
	ctx.font = `600 33px ${fontStack()}`;
	let y = 1085;
	for (const trait of input.archetype.traits) {
		ctx.fillStyle = '#a78bfa';
		ctx.fillText('▸', 130, y);
		ctx.fillStyle = '#cbd5e1';
		ctx.fillText(trait, 175, y);
		y += 58;
	}

	ctx.textAlign = 'center';
	ctx.fillStyle = '#94a3b8';
	ctx.font = `600 30px ${fontStack()}`;
	ctx.fillText(
		`${input.secondary.emoji} with a side of ${input.secondary.name.replace(/^The /, 'the ')}`,
		W / 2,
		1290
	);

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed.'))),
			'image/png'
		);
	});
}

function fontStack(): string {
	return `'Inter Variable', 'Inter', system-ui, sans-serif`;
}

function paintGlow(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	color: string,
	alpha: number
) {
	const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
	glow.addColorStop(0, withAlpha(color, alpha));
	glow.addColorStop(1, withAlpha(color, 0));
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, W, H);
}

function roundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number
) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number
) {
	const words = text.split(' ');
	let line = '';
	for (const word of words) {
		const candidate = line ? `${line} ${word}` : word;
		if (line && ctx.measureText(candidate).width > maxWidth) {
			ctx.fillText(line, x, y);
			line = word;
			y += lineHeight;
		} else {
			line = candidate;
		}
	}
	if (line) ctx.fillText(line, x, y);
}

function withAlpha(hex: string, alpha: number): string {
	const [r, g, b] = hexToRgb(hex);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function lighten(hex: string): string {
	const [r, g, b] = hexToRgb(hex).map((c) => Math.min(255, Math.round(c + (255 - c) * 0.35)));
	return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgb(hex: string): [number, number, number] {
	const value = hex.replace('#', '');
	return [
		parseInt(value.slice(0, 2), 16),
		parseInt(value.slice(2, 4), 16),
		parseInt(value.slice(4, 6), 16)
	];
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = url;
	});
}

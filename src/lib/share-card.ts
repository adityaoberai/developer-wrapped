import type { Archetype } from '$lib/types';

export interface ShareCardInput {
	archetype: Archetype;
	secondary: Archetype;
	displayName: string;
	githubUsername: string;
	avatarUrl: string;
}

/** Wrapped card formats: story 9:16, portrait 4:5, square 1:1. */
export type CardFormat = 'story' | 'portrait' | 'square';

export const CARD_FORMATS: { id: CardFormat; label: string; ratio: string }[] = [
	{ id: 'story', label: 'Story', ratio: '9:16' },
	{ id: 'portrait', label: 'Post', ratio: '4:5' },
	{ id: 'square', label: 'Square', ratio: '1:1' }
];

const FORMAT_SIZES: Record<CardFormat, { w: number; h: number }> = {
	story: { w: 1080, h: 1920 },
	portrait: { w: 1080, h: 1350 },
	square: { w: 1080, h: 1080 }
};

export interface WrappedCardInput {
	displayName: string;
	githubUsername: string;
	avatarUrl: string;
	/** Reporting period, e.g. "2025-07-18 → 2026-07-17". */
	periodLabel: string;
	/** The one distinctive metric on the card. */
	headline: { value: string; label: string };
	/** Up to four supporting stats. */
	stats: { value: string; label: string }[];
	archetypeName?: string;
	archetypeEmoji?: string;
	/** Quiz self-assessment; when present the card shows "You said vs. GitHub says". */
	quizArchetypeName?: string;
	quizArchetypeEmoji?: string;
	gradient: [string, string];
	/** Clear brand URL printed on every card, e.g. "wrapped.dev.example". */
	brandUrl: string;
}

/**
 * Draw a Wrapped stats card on an offscreen canvas in the requested format.
 * Every card carries the headline metric, the reporting period, and the brand
 * URL, so a screenshot of it is always attributable and time-scoped.
 */
export async function renderWrappedCard(
	input: WrappedCardInput,
	format: CardFormat
): Promise<Blob> {
	const { w, h } = FORMAT_SIZES[format];
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas is not supported in this browser.');

	await document.fonts.ready;
	const [a, b] = input.gradient;

	ctx.fillStyle = '#0f172a';
	ctx.fillRect(0, 0, w, h);
	paintGlowRect(ctx, w, h, w * 0.85, -80, w * 0.6, a, 0.55);
	paintGlowRect(ctx, w, h, w * 0.05, h + 60, w * 0.55, b, 0.4);

	ctx.strokeStyle = 'rgba(226, 232, 240, 0.18)';
	ctx.lineWidth = 3;
	roundedRect(ctx, 42, 42, w - 84, h - 84, 44);
	ctx.stroke();

	// Vertical rhythm scales with the format; the content column stays 1080 wide.
	const compact = format === 'square';
	let y = compact ? 128 : 150;

	ctx.textAlign = 'center';
	ctx.fillStyle = '#a78bfa';
	ctx.font = `800 ${compact ? 30 : 34}px ${fontStack()}`;
	ctx.fillText('D E V E L O P E R   W R A P P E D', w / 2, y);
	y += compact ? 44 : 56;

	ctx.fillStyle = '#94a3b8';
	ctx.font = `600 ${compact ? 26 : 30}px ${fontStack()}`;
	ctx.fillText(input.periodLabel, w / 2, y);
	y += compact ? 66 : 96;

	// Avatar (skipped in square to keep the metric dominant).
	if (!compact) {
		const avatar = input.avatarUrl ? await loadImage(input.avatarUrl) : null;
		const r = format === 'story' ? 108 : 84;
		if (avatar) {
			const cy = y + r;
			ctx.save();
			ctx.beginPath();
			ctx.arc(w / 2, cy, r, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(avatar, w / 2 - r, cy - r, r * 2, r * 2);
			ctx.restore();
			ctx.beginPath();
			ctx.arc(w / 2, cy, r, 0, Math.PI * 2);
			ctx.strokeStyle = a;
			ctx.lineWidth = 6;
			ctx.stroke();
			y += r * 2 + (format === 'story' ? 84 : 64);
		}
	}

	ctx.fillStyle = '#f8fafc';
	ctx.font = `700 ${compact ? 40 : 44}px ${fontStack()}`;
	ctx.fillText(input.displayName || input.githubUsername || 'Mystery Developer', w / 2, y, w - 200);
	y += compact ? 44 : 50;
	if (input.githubUsername) {
		ctx.fillStyle = '#94a3b8';
		ctx.font = `600 ${compact ? 28 : 32}px ${fontStack()}`;
		ctx.fillText(`@${input.githubUsername}`, w / 2, y, w - 240);
	}
	y += format === 'story' ? 170 : compact ? 110 : 130;

	// Headline metric — the one distinctive number.
	const gradient = ctx.createLinearGradient(140, 0, w - 140, 0);
	gradient.addColorStop(0, lighten(a));
	gradient.addColorStop(1, lighten(b));
	ctx.fillStyle = gradient;
	ctx.font = `900 ${format === 'story' ? 220 : compact ? 150 : 180}px ${fontStack()}`;
	ctx.fillText(input.headline.value, w / 2, y, w - 180);
	y += compact ? 62 : 76;
	ctx.fillStyle = '#e2e8f0';
	ctx.font = `700 ${compact ? 40 : 46}px ${fontStack()}`;
	ctx.fillText(input.headline.label, w / 2, y);
	y += format === 'story' ? 150 : compact ? 92 : 110;

	// Supporting stats. Portrait trades its 4th row for the two-line quiz
	// confrontation — with all four the bottom cluster collides with the
	// bottom-anchored brand URL (1350px leaves ~108px of slack).
	const statCount = compact || (format === 'portrait' && input.quizArchetypeName) ? 3 : 4;
	const stats = input.stats.slice(0, statCount);
	ctx.textAlign = 'left';
	const rowH = format === 'story' ? 84 : compact ? 66 : 74;
	for (const stat of stats) {
		ctx.fillStyle = '#a78bfa';
		ctx.font = `600 ${compact ? 30 : 33}px ${fontStack()}`;
		ctx.fillText(stat.label, 150, y, w / 2 - 100);
		ctx.textAlign = 'right';
		ctx.fillStyle = '#f8fafc';
		ctx.font = `800 ${compact ? 32 : 36}px ${fontStack()}`;
		ctx.fillText(stat.value, w - 150, y, w / 2 - 100);
		ctx.textAlign = 'left';
		y += rowH;
	}

	// Archetype line(s) — story/portrait have room for them. With a quiz result
	// the card carries the full confrontation; without one, just the verdict.
	if (input.archetypeName && !compact) {
		y += 12;
		ctx.textAlign = 'center';
		ctx.fillStyle = '#cbd5e1';
		ctx.font = `600 34px ${fontStack()}`;
		if (input.quizArchetypeName) {
			ctx.fillText(
				`${input.quizArchetypeEmoji ?? ''} You said: ${input.quizArchetypeName}`.trim(),
				w / 2,
				y,
				w - 200
			);
			y += 46;
		}
		ctx.fillText(
			`${input.archetypeEmoji ?? ''} GitHub says: ${input.archetypeName}`.trim(),
			w / 2,
			y,
			w - 200
		);
	}

	// Brand URL anchored to the bottom of every format.
	ctx.textAlign = 'center';
	ctx.fillStyle = '#94a3b8';
	ctx.font = `700 ${compact ? 28 : 32}px ${fontStack()}`;
	ctx.fillText(input.brandUrl, w / 2, h - (compact ? 96 : 120));

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed.'))),
			'image/png'
		);
	});
}

/** Share a rendered card through the native share sheet where supported. */
export async function shareCardFile(blob: Blob, fileName: string, text: string): Promise<boolean> {
	const file = new File([blob], fileName, { type: 'image/png' });
	if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) {
		return false;
	}
	try {
		await navigator.share({ files: [file], text });
		return true;
	} catch {
		// user dismissed the sheet — treated as handled
		return true;
	}
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

	// maxWidth keeps arbitrarily long names inside the card frame.
	ctx.fillStyle = '#f8fafc';
	ctx.font = `700 44px ${fontStack()}`;
	ctx.fillText(
		input.displayName || input.githubUsername || 'Mystery Developer',
		W / 2,
		460,
		W - 200
	);
	if (input.githubUsername) {
		ctx.fillStyle = '#94a3b8';
		ctx.font = `600 32px ${fontStack()}`;
		ctx.fillText(`@${input.githubUsername}`, W / 2, 508, W - 240);
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
	paintGlowRect(ctx, W, H, x, y, radius, color, alpha);
}

function paintGlowRect(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
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
	ctx.fillRect(0, 0, w, h);
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

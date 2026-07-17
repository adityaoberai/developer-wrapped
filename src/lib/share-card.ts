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

/* ============================================================
   "TERMINAL RECEIPTS" palette — mirrors src/app.css tokens.
   Thermal paper, black ink, one vermilion stamp + a pen blue.
   The machine layer (labels, numbers, source, chrome) is set in
   monospace; long-form reading (taglines) stays in Inter.
   ============================================================ */
const PAPER = '#e9e3d4';
const RECEIPT = '#fbf9f3';
const INK = '#1b1712';
const MUTED = '#5b5344';
const PEN = '#274b7a';
const RULE = 'rgba(27, 23, 18, 0.30)';
const BAND = 'rgba(27, 23, 18, 0.055)';
const CARD_SHADOW = 'rgba(27, 23, 18, 0.12)';

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
	const accent = input.gradient[0];
	const accentInk = mix(accent, INK, 0.65);
	ctx.textBaseline = 'alphabetic';

	// Page (paper) + the receipt "ticket" with a hard, blur-less drop shadow.
	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, w, h);

	const pad = 34;
	const cardX = pad;
	const cardY = pad;
	const cardW = w - pad * 2;
	const cardH = h - pad * 2;
	const radius = 26;
	roundedRect(ctx, cardX + 10, cardY + 14, cardW, cardH, radius);
	ctx.fillStyle = CARD_SHADOW;
	ctx.fill();
	roundedRect(ctx, cardX, cardY, cardW, cardH, radius);
	ctx.fillStyle = RECEIPT;
	ctx.fill();
	ctx.lineWidth = 2.5;
	ctx.strokeStyle = INK;
	ctx.stroke();

	const midX = w / 2;
	const contentLeft = cardX + 78;
	const contentRight = cardX + cardW - 78;
	const contentW = contentRight - contentLeft;

	// Vertical rhythm scales with the format; the content column stays centred.
	const compact = format === 'square';
	let y = compact ? 128 : 150;

	// Merchant header — the wordmark, set as tracked monospace.
	ctx.textAlign = 'center';
	ctx.fillStyle = MUTED;
	ctx.font = `700 ${compact ? 18 : 20}px ${monoStack()}`;
	drawTracked(ctx, '— NOW PRINTING —', midX, y, 4, 'center');
	y += compact ? 44 : 56;

	ctx.fillStyle = INK;
	ctx.font = `700 ${compact ? 32 : 36}px ${monoStack()}`;
	drawTracked(ctx, 'DEVELOPER WRAPPED', midX, y, 6, 'center');
	y += compact ? 40 : 48;

	ctx.fillStyle = MUTED;
	ctx.font = `600 ${compact ? 24 : 28}px ${monoStack()}`;
	ctx.fillText(input.periodLabel, midX, y, contentW);

	// Perforation "tear here" rule, drawn inside the header gap.
	drawPerf(ctx, contentLeft, contentRight, y + (compact ? 30 : 42), RULE);
	y += compact ? 66 : 96;

	// Rotated "CERTIFIED" rubber stamp in the top-right corner.
	drawStamp(ctx, cardX + cardW - 132, cardY + (compact ? 108 : 122), -8, accentInk);

	// Avatar (skipped in square to keep the metric dominant).
	if (!compact) {
		const avatar = input.avatarUrl ? await loadImage(input.avatarUrl) : null;
		const r = format === 'story' ? 108 : 84;
		if (avatar) {
			const cy = y + r;
			ctx.save();
			ctx.beginPath();
			ctx.arc(midX, cy, r, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(avatar, midX - r, cy - r, r * 2, r * 2);
			ctx.restore();
			// Solid ink ring + a dashed "notary" ring in the archetype accent.
			ctx.beginPath();
			ctx.arc(midX, cy, r, 0, Math.PI * 2);
			ctx.strokeStyle = INK;
			ctx.lineWidth = 5;
			ctx.stroke();
			ctx.save();
			ctx.setLineDash([6, 7]);
			ctx.lineWidth = 2;
			ctx.strokeStyle = accent;
			ctx.beginPath();
			ctx.arc(midX, cy, r + 10, 0, Math.PI * 2);
			ctx.stroke();
			ctx.restore();
			y += r * 2 + (format === 'story' ? 84 : 64);
		}
	}

	ctx.textAlign = 'center';
	ctx.fillStyle = INK;
	ctx.font = `700 ${compact ? 40 : 44}px ${monoStack()}`;
	ctx.fillText(input.displayName || input.githubUsername || 'Mystery Developer', midX, y, contentW);
	y += compact ? 44 : 50;
	if (input.githubUsername) {
		ctx.fillStyle = MUTED;
		ctx.font = `600 ${compact ? 28 : 32}px ${monoStack()}`;
		ctx.fillText(`@${input.githubUsername}`, midX, y, contentW);
	}
	y += format === 'story' ? 170 : compact ? 110 : 130;

	// Headline metric — the one distinctive number, solid accent ink in a
	// bordered "bignum" frame. No gradients: this is a paper world.
	const valFont = format === 'story' ? 200 : compact ? 140 : 172;
	const frameTop = y - valFont * 0.72;
	const labelY = y + (compact ? 62 : 76);
	const frameBottom = labelY + (compact ? 22 : 26);
	ctx.lineWidth = 2.5;
	ctx.strokeStyle = INK;
	strokeRect(ctx, contentLeft, frameTop, contentW, frameBottom - frameTop);
	ctx.textAlign = 'center';
	ctx.fillStyle = accentInk;
	ctx.font = `700 ${valFont}px ${monoStack()}`;
	ctx.fillText(input.headline.value, midX, y, contentW - 48);
	ctx.fillStyle = MUTED;
	ctx.font = `700 ${compact ? 22 : 26}px ${monoStack()}`;
	drawTracked(ctx, input.headline.label.toUpperCase(), midX, labelY, 3, 'center');
	y += format === 'story' ? 150 : compact ? 92 : 110;

	// Supporting stats as ledger rows (label ······· value dot leaders).
	// Portrait trades its 4th row for the two-line quiz confrontation — with
	// all four the bottom cluster collides with the bottom-anchored brand URL
	// (1350px leaves ~108px of slack).
	const statCount = compact || (format === 'portrait' && input.quizArchetypeName) ? 3 : 4;
	const stats = input.stats.slice(0, statCount);
	const rowH = format === 'story' ? 84 : compact ? 66 : 74;
	const statFont = compact ? 30 : 33;
	for (const stat of stats) {
		drawLedgerRow(ctx, contentLeft, contentRight, y, stat.label, stat.value, statFont);
		y += rowH;
	}

	// Archetype line(s) — story/portrait have room. With a quiz result the card
	// carries the full "You said vs. GitHub says" confrontation, the struck-out
	// self-assessment in pen blue and the verdict stamped in accent ink.
	if (input.archetypeName && !compact) {
		y += 12;
		ctx.textAlign = 'center';
		ctx.font = `700 32px ${monoStack()}`;
		if (input.quizArchetypeName) {
			const said = `${input.quizArchetypeEmoji ?? ''} You said: ${input.quizArchetypeName}`.trim();
			ctx.fillStyle = PEN;
			ctx.fillText(said, midX, y, contentW);
			const saidW = Math.min(ctx.measureText(said).width, contentW);
			ctx.save();
			ctx.strokeStyle = 'rgba(39, 75, 122, 0.55)';
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(midX - saidW / 2, y - 10);
			ctx.lineTo(midX + saidW / 2, y - 10);
			ctx.stroke();
			ctx.restore();
			y += 46;
		}
		ctx.fillStyle = accentInk;
		ctx.fillText(
			`${input.archetypeEmoji ?? ''} GitHub says: ${input.archetypeName}`.trim(),
			midX,
			y,
			contentW
		);
	}

	// Brand URL anchored to the bottom of every format.
	const brandY = h - (compact ? 96 : 120);

	// A CSS-barcode strip — room only in the tall story format.
	if (format === 'story') {
		const barTop = brandY - 300;
		ctx.textAlign = 'left';
		ctx.fillStyle = MUTED;
		ctx.font = `600 20px ${monoStack()}`;
		drawTracked(ctx, 'NO RETURNS · NO REFUNDS', contentLeft, barTop, 2, 'left');
		ctx.textAlign = 'right';
		drawTracked(ctx, 'DW-2026', contentRight, barTop, 2, 'right');
		ctx.textAlign = 'left';
		drawBarcode(ctx, contentLeft, barTop + 16, contentW, 66);
	}

	// The "source:" line rendered as the hero stamped device, above the brand.
	const sourceSeg: { t: string; bold: boolean }[] = input.githubUsername
		? [
				{ t: 'github.com/', bold: false },
				{ t: input.githubUsername, bold: true }
			]
		: [
				{ t: 'source=', bold: false },
				{ t: 'github', bold: true }
			];
	drawSourceStamp(
		ctx,
		contentLeft,
		brandY - (compact ? 78 : 92),
		contentW,
		compact ? 18 : 20,
		sourceSeg,
		accentInk
	);

	ctx.textAlign = 'center';
	ctx.fillStyle = INK;
	ctx.font = `700 ${compact ? 26 : 30}px ${monoStack()}`;
	drawTracked(ctx, input.brandUrl, midX, brandY, 2, 'center');

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
	const accent = input.archetype.gradient[0];
	const accentInk = mix(accent, INK, 0.65);
	ctx.textBaseline = 'alphabetic';

	// Page (paper) + receipt ticket with a hard offset shadow.
	ctx.fillStyle = PAPER;
	ctx.fillRect(0, 0, W, H);

	const pad = 34;
	roundedRect(ctx, pad + 10, pad + 14, W - pad * 2, H - pad * 2, 26);
	ctx.fillStyle = CARD_SHADOW;
	ctx.fill();
	roundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 26);
	ctx.fillStyle = RECEIPT;
	ctx.fill();
	ctx.lineWidth = 2.5;
	ctx.strokeStyle = INK;
	ctx.stroke();

	const contentLeft = pad + 78;
	const contentRight = W - pad - 78;
	const contentW = contentRight - contentLeft;

	ctx.textAlign = 'center';
	ctx.fillStyle = INK;
	ctx.font = `700 34px ${monoStack()}`;
	drawTracked(ctx, 'DEVELOPER WRAPPED', W / 2, 150, 6, 'center');
	drawPerf(ctx, contentLeft, contentRight, 186, RULE);

	// Rotated "CERTIFIED" stamp, top-right corner.
	drawStamp(ctx, W - pad - 132, pad + 122, -8, accentInk);

	// Avatar with a solid ink ring + dashed accent notary ring.
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
		ctx.strokeStyle = INK;
		ctx.lineWidth = 5;
		ctx.stroke();
		ctx.save();
		ctx.setLineDash([6, 7]);
		ctx.lineWidth = 2;
		ctx.strokeStyle = accent;
		ctx.beginPath();
		ctx.arc(W / 2, 300, 102, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
	}

	// maxWidth keeps arbitrarily long names inside the card frame.
	ctx.fillStyle = INK;
	ctx.font = `700 44px ${monoStack()}`;
	ctx.fillText(
		input.displayName || input.githubUsername || 'Mystery Developer',
		W / 2,
		460,
		contentW
	);
	if (input.githubUsername) {
		ctx.fillStyle = MUTED;
		ctx.font = `600 32px ${monoStack()}`;
		ctx.fillText(`@${input.githubUsername}`, W / 2, 508, contentW);
	}

	// Verdict — emoji + archetype name in solid accent ink (no gradient fill).
	ctx.font = '120px serif';
	ctx.fillStyle = INK;
	ctx.fillText(input.archetype.emoji, W / 2, 660);

	ctx.fillStyle = accentInk;
	ctx.font = `700 84px ${monoStack()}`;
	wrapText(ctx, input.archetype.name, W / 2, 780, contentW, 92);

	// The tagline is long-form reading → Inter, for legibility.
	ctx.fillStyle = INK;
	ctx.font = `500 38px ${fontStack()}`;
	wrapText(ctx, `“${input.archetype.tagline}”`, W / 2, 950, W - 240, 52);

	// Traits as a caret-led machine list.
	ctx.textAlign = 'left';
	ctx.font = `600 33px ${monoStack()}`;
	let y = 1085;
	for (const trait of input.archetype.traits) {
		ctx.fillStyle = accent;
		ctx.fillText('›', 130, y);
		ctx.fillStyle = INK;
		ctx.fillText(trait, 175, y);
		y += 58;
	}

	ctx.textAlign = 'center';
	ctx.fillStyle = MUTED;
	ctx.font = `600 30px ${monoStack()}`;
	ctx.fillText(
		`${input.secondary.emoji} with a side of ${input.secondary.name.replace(/^The /, 'the ')}`,
		W / 2,
		1290,
		contentW
	);

	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed.'))),
			'image/png'
		);
	});
}

/** Long-form / reading layer: Inter (matches --sans in app.css). */
function fontStack(): string {
	return `'Inter Variable', 'Inter', system-ui, sans-serif`;
}

/** Machine layer: monospace (matches --mono in app.css). */
function monoStack(): string {
	return `ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;
}

/**
 * Draw letter-spaced ("tracked") text — the terminal personality — without
 * relying on the newer ctx.letterSpacing API. Returns the total advance width.
 */
function drawTracked(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	spacing: number,
	align: 'left' | 'center' | 'right' = 'left'
): number {
	const chars = [...text];
	const widths = chars.map((c) => ctx.measureText(c).width);
	const total = widths.reduce((a, c) => a + c, 0) + spacing * Math.max(0, chars.length - 1);
	let sx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
	const prevAlign = ctx.textAlign;
	ctx.textAlign = 'left';
	for (let i = 0; i < chars.length; i++) {
		ctx.fillText(chars[i], sx, y);
		sx += widths[i] + spacing;
	}
	ctx.textAlign = prevAlign;
	return total;
}

/** Dashed "tear here" perforation rule. */
function drawPerf(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, color: string) {
	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 2;
	ctx.setLineDash([12, 9]);
	ctx.beginPath();
	ctx.moveTo(x1, y);
	ctx.lineTo(x2, y);
	ctx.stroke();
	ctx.restore();
}

/** Ledger row: label ······· value, with dotted leaders. */
function drawLedgerRow(
	ctx: CanvasRenderingContext2D,
	xL: number,
	xR: number,
	y: number,
	label: string,
	value: string,
	fontPx: number
) {
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';
	ctx.font = `500 ${fontPx}px ${monoStack()}`;
	ctx.fillStyle = MUTED;
	ctx.fillText(label, xL, y, (xR - xL) * 0.55);
	const labelW = Math.min(ctx.measureText(label).width, (xR - xL) * 0.55);

	ctx.textAlign = 'right';
	ctx.font = `700 ${fontPx}px ${monoStack()}`;
	ctx.fillStyle = INK;
	ctx.fillText(value, xR, y, (xR - xL) * 0.4);
	const valueW = Math.min(ctx.measureText(value).width, (xR - xL) * 0.4);
	ctx.textAlign = 'left';

	const x1 = xL + labelW + 14;
	const x2 = xR - valueW - 14;
	if (x2 > x1) {
		ctx.save();
		ctx.strokeStyle = RULE;
		ctx.lineWidth = 2;
		ctx.setLineDash([2, 7]);
		ctx.beginPath();
		ctx.moveTo(x1, y - fontPx * 0.28);
		ctx.lineTo(x2, y - fontPx * 0.28);
		ctx.stroke();
		ctx.restore();
	}
}

/** THE hero device — the machine-readable "source:" stamp. */
function drawSourceStamp(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	fontPx: number,
	segments: { t: string; bold: boolean }[],
	boldColor: string
) {
	const padX = fontPx * 0.7;
	const padY = fontPx * 0.55;
	const rowH = fontPx + padY * 2;
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';

	// Banded body + hairline border.
	ctx.fillStyle = BAND;
	ctx.fillRect(x, y, width, rowH);
	ctx.lineWidth = 1.5;
	ctx.strokeStyle = RULE;
	strokeRect(ctx, x, y, width, rowH);

	// Ink "SOURCE" tag.
	ctx.font = `700 ${fontPx}px ${monoStack()}`;
	const tag = 'SOURCE';
	const tagW = ctx.measureText(tag).width + padX * 2;
	ctx.fillStyle = INK;
	ctx.fillRect(x, y, tagW, rowH);
	ctx.fillStyle = RECEIPT;
	ctx.font = `700 ${fontPx * 0.9}px ${monoStack()}`;
	const baseline = y + rowH - padY - 2;
	drawTracked(ctx, tag, x + padX, baseline, 2, 'left');

	// key=value payload, value emphasised in accent ink.
	let vx = x + tagW + padX;
	for (const seg of segments) {
		ctx.font = `${seg.bold ? '700' : '500'} ${fontPx}px ${monoStack()}`;
		ctx.fillStyle = seg.bold ? boldColor : INK;
		ctx.fillText(seg.t, vx, baseline);
		vx += ctx.measureText(seg.t).width;
	}
}

/** CSS-barcode style strip built from variable-width ink bars. */
function drawBarcode(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number
) {
	const pattern = [
		2, 2, 1, 3, 1, 1, 3, 2, 1, 4, 2, 1, 1, 3, 2, 2, 1, 2, 3, 1, 2, 1, 3, 2, 1, 1, 2, 4
	];
	const unit = 4;
	ctx.fillStyle = INK;
	let cx = x;
	let i = 0;
	let inked = true;
	while (cx < x + width) {
		const bw = pattern[i % pattern.length] * unit;
		if (inked) ctx.fillRect(cx, y, Math.min(bw, x + width - cx), height);
		cx += bw;
		inked = !inked;
		i++;
	}
}

/** Rotated rubber "CERTIFIED" stamp. */
function drawStamp(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	angleDeg: number,
	color: string
) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate((angleDeg * Math.PI) / 180);
	ctx.lineWidth = 3;
	ctx.strokeStyle = color;
	ctx.fillStyle = color;
	const bw = 196;
	const bh = 66;
	roundedRect(ctx, -bw / 2, -bh / 2, bw, bh, 6);
	ctx.stroke();
	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.font = `700 24px ${monoStack()}`;
	drawTracked(ctx, 'CERTIFIED', 0, -2, 3, 'center');
	ctx.font = `700 12px ${monoStack()}`;
	drawTracked(ctx, 'TRUE COPY', 0, 18, 3, 'center');
	ctx.restore();
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

function strokeRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
	ctx.beginPath();
	ctx.rect(x, y, w, h);
	ctx.stroke();
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

/** Mix two hex colours; `weight` is the share of the first colour (0–1). */
function mix(hex1: string, hex2: string, weight: number): string {
	const [r1, g1, b1] = hexToRgb(hex1);
	const [r2, g2, b2] = hexToRgb(hex2);
	const r = Math.round(r1 * weight + r2 * (1 - weight));
	const g = Math.round(g1 * weight + g2 * (1 - weight));
	const b = Math.round(b1 * weight + b2 * (1 - weight));
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

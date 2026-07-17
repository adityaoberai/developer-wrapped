import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import inter400 from './fonts/inter-latin-400-normal.woff?inline';
import inter700 from './fonts/inter-latin-700-normal.woff?inline';
import inter900 from './fonts/inter-latin-900-normal.woff?inline';

export interface OgCard {
	title: string;
	subtitle: string;
	handle: string;
	gradient: [string, string];
}

const fromDataUri = (uri: string) => Buffer.from(uri.split(',')[1], 'base64');
const fonts = [
	{ name: 'Inter', data: fromDataUri(inter400), weight: 400 as const, style: 'normal' as const },
	{ name: 'Inter', data: fromDataUri(inter700), weight: 700 as const, style: 'normal' as const },
	{ name: 'Inter', data: fromDataUri(inter900), weight: 900 as const, style: 'normal' as const }
];

/* "Terminal Receipts" palette — mirrors the tokens in src/app.css.
   Satori resolves inline styles only (no CSS custom properties or classes),
   so the token *values* are inlined here. Keep in sync with app.css. */
const PAPER = '#E9E3D4';
const RECEIPT = '#FBF9F3';
const INK = '#1B1712';
const MUTED = '#5B5344';
const STAMP = '#B23016';
const STAMP_INK = '#8F2410';
const RULE = 'rgba(27,23,18,0.30)';
const BAND = 'rgba(27,23,18,0.055)';

/* A short, fixed barcode pattern (bar-width units). Purely decorative:
   even indices print ink bars, odd indices leave paper gaps. */
const BARCODE = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 3, 1, 2, 1, 3, 2, 1, 3];

type Node = { type: string; props: Record<string, unknown> };

const el = (type: string, style: Record<string, unknown>, children?: Node[] | string): Node => ({
	type,
	props: { style, children }
});

/** Render a 1200x630 Open Graph PNG. */
export async function renderOgImage(card: OgCard): Promise<Buffer> {
	const [a, b] = card.gradient;

	const tree = el(
		'div',
		{
			display: 'flex',
			width: '100%',
			height: '100%',
			padding: '40px',
			backgroundColor: PAPER,
			backgroundImage: 'linear-gradient(180deg, rgba(27,23,18,0.06), rgba(27,23,18,0) 18%)',
			color: INK,
			fontFamily: 'Inter'
		},
		[
			// The receipt sheet: ink-bordered stock with a hard vermilion offset shadow.
			el(
				'div',
				{
					display: 'flex',
					flexDirection: 'column',
					flexGrow: 1,
					backgroundColor: RECEIPT,
					border: `2px solid ${INK}`,
					borderRadius: '4px',
					boxShadow: `12px 12px 0 ${STAMP}`
				},
				[
					// Machine chrome: the printed status bar / merchant header.
					el(
						'div',
						{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							padding: '13px 30px',
							backgroundColor: INK,
							color: RECEIPT,
							borderTopLeftRadius: '3px',
							borderTopRightRadius: '3px'
						},
						[
							el('div', { display: 'flex', alignItems: 'center', gap: '16px' }, [
								el('div', {
									width: '14px',
									height: '14px',
									borderRadius: '50%',
									backgroundColor: STAMP
								}),
								el(
									'div',
									{
										display: 'flex',
										fontSize: '20px',
										fontWeight: 700,
										letterSpacing: '0.26em'
									},
									'DEVELOPER WRAPPED'
								)
							]),
							el(
								'div',
								{
									display: 'flex',
									fontSize: '17px',
									fontWeight: 700,
									letterSpacing: '0.16em',
									color: 'rgba(251,249,243,0.72)'
								},
								'REG 04 · RECEIPT #DW-2026'
							)
						]
					),
					// Per-archetype accent band (the only place the archetype gradient survives).
					el('div', { height: '8px', backgroundImage: `linear-gradient(90deg, ${a}, ${b})` }),
					// Body: header / verdict / footer, spread down the sheet.
					el(
						'div',
						{
							display: 'flex',
							flexDirection: 'column',
							flexGrow: 1,
							justifyContent: 'space-between',
							padding: '34px 52px 30px'
						},
						[
							// Header row: kicker + rubber stamp.
							el(
								'div',
								{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
								[
									el(
										'div',
										{
											display: 'flex',
											alignItems: 'center',
											gap: '10px',
											fontSize: '20px',
											fontWeight: 700,
											letterSpacing: '0.24em',
											textTransform: 'uppercase',
											color: MUTED
										},
										[
											el('div', { display: 'flex', color: STAMP, fontWeight: 700 }, '›'),
											el('div', { display: 'flex' }, 'The Verdict')
										]
									),
									el(
										'div',
										{
											display: 'flex',
											padding: '8px 16px',
											border: `2px solid ${STAMP}`,
											borderRadius: '3px',
											color: STAMP_INK,
											fontSize: '16px',
											fontWeight: 700,
											letterSpacing: '0.16em',
											textTransform: 'uppercase',
											transform: 'rotate(3deg)'
										},
										'Certified'
									)
								]
							),
							// Verdict: the headline + narration.
							el('div', { display: 'flex', flexDirection: 'column', gap: '20px' }, [
								el(
									'div',
									{
										display: 'flex',
										fontSize: card.title.length > 42 ? '52px' : '62px',
										fontWeight: 900,
										lineHeight: 1.05,
										letterSpacing: '-0.02em',
										color: INK,
										maxWidth: '1000px'
									},
									card.title
								),
								el(
									'div',
									{
										display: 'flex',
										fontSize: '27px',
										fontWeight: 400,
										lineHeight: 1.35,
										color: MUTED,
										maxWidth: '900px'
									},
									card.subtitle
								)
							]),
							// Footer: the hero source: stamp, a tear rule, then identity + barcode.
							el('div', { display: 'flex', flexDirection: 'column', gap: '18px' }, [
								el(
									'div',
									{
										display: 'flex',
										alignItems: 'stretch',
										border: `1px solid ${RULE}`,
										borderRadius: '2px',
										backgroundColor: BAND
									},
									[
										el(
											'div',
											{
												display: 'flex',
												alignItems: 'center',
												padding: '0 16px',
												backgroundColor: INK,
												color: RECEIPT,
												fontSize: '16px',
												fontWeight: 700,
												letterSpacing: '0.18em',
												textTransform: 'uppercase'
											},
											'Source'
										),
										el(
											'div',
											{
												display: 'flex',
												alignItems: 'center',
												padding: '9px 18px',
												color: INK,
												fontSize: '17px',
												letterSpacing: '0.02em'
											},
											[
												el('div', { display: 'flex' }, 'user='),
												el(
													'div',
													{ display: 'flex', color: STAMP_INK, fontWeight: 700 },
													card.handle
												)
											]
										)
									]
								),
								el(
									'div',
									{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'flex-end',
										borderTop: `2px dashed ${RULE}`,
										paddingTop: '22px'
									},
									[
										el('div', { display: 'flex', flexDirection: 'column', gap: '8px' }, [
											el(
												'div',
												{
													display: 'flex',
													fontSize: '24px',
													fontWeight: 700,
													color: INK,
													letterSpacing: '0.02em'
												},
												card.handle
											),
											el(
												'div',
												{ display: 'flex', alignItems: 'stretch', height: '28px' },
												BARCODE.map((w, i) =>
													el('div', {
														width: `${w * 2}px`,
														height: '28px',
														backgroundColor: i % 2 === 0 ? INK : 'transparent'
													})
												)
											)
										]),
										el(
											'div',
											{
												display: 'flex',
												fontSize: '24px',
												fontWeight: 700,
												letterSpacing: '0.01em'
											},
											[
												el('div', { display: 'flex', color: MUTED }, 'Eight questions. '),
												el('div', { display: 'flex', color: STAMP_INK }, 'Zero mercy.')
											]
										)
									]
								)
							])
						]
					)
				]
			)
		]
	);

	const svg = await satori(tree as never, { width: 1200, height: 630, fonts });
	return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

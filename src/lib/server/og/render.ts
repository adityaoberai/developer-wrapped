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
			width: '100%',
			height: '100%',
			display: 'flex',
			flexDirection: 'column',
			justifyContent: 'space-between',
			padding: '72px 80px',
			backgroundColor: '#0F172A',
			backgroundImage: `linear-gradient(125deg, ${a}55 0%, #0F172A00 45%, ${b}40 100%)`,
			color: '#F8FAFC',
			fontFamily: 'Inter'
		},
		[
			el(
				'div',
				{
					display: 'flex',
					alignItems: 'center',
					gap: '16px'
				},
				[
					el('div', {
						width: '28px',
						height: '28px',
						borderRadius: '8px',
						backgroundImage: `linear-gradient(135deg, ${a}, ${b})`
					}),
					el(
						'div',
						{
							fontSize: '28px',
							fontWeight: 700,
							letterSpacing: '0.18em',
							color: '#A78BFA'
						},
						'DEVELOPER WRAPPED'
					)
				]
			),
			el('div', { display: 'flex', flexDirection: 'column', gap: '24px' }, [
				el(
					'div',
					{
						fontSize: card.title.length > 42 ? '64px' : '76px',
						fontWeight: 900,
						lineHeight: 1.08,
						letterSpacing: '-0.02em',
						maxWidth: '1020px'
					},
					card.title
				),
				el(
					'div',
					{ fontSize: '34px', fontWeight: 400, color: '#CBD5E1', maxWidth: '960px' },
					card.subtitle
				)
			]),
			el(
				'div',
				{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					fontSize: '26px',
					color: '#94A3B8',
					fontWeight: 700
				},
				[
					el('div', { display: 'flex' }, card.handle),
					el('div', { display: 'flex' }, 'Eight questions. Zero mercy.')
				]
			)
		]
	);

	const svg = await satori(tree as never, { width: 1200, height: 630, fonts });
	return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

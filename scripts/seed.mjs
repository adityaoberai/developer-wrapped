import { readFileSync } from 'node:fs';
import { Client, TablesDB } from 'node-appwrite';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

const config = read('../appwrite.config.json');
const questions = read('../src/lib/content/questions.json');
const archetypes = read('../src/lib/content/archetypes.json');

const apiKey = process.env.APPWRITE_API_KEY;
if (!apiKey) {
	console.error(
		'APPWRITE_API_KEY is required (e.g. an ephemeral key from `appwrite project create-ephemeral-key`).'
	);
	process.exit(1);
}

const client = new Client()
	.setEndpoint(config.endpoint)
	.setProject(config.projectId)
	.setKey(apiKey);
const tablesDB = new TablesDB(client);
const databaseId = 'wrapped';

for (const q of questions) {
	await tablesDB.upsertRow({
		databaseId,
		tableId: 'questions',
		rowId: q.id,
		data: {
			prompt: q.prompt,
			options_json: JSON.stringify(q.options),
			weights_json: JSON.stringify(q.weights),
			position: q.position,
			active: true
		}
	});
	console.log(`questions/${q.id} upserted`);
}

for (const a of archetypes) {
	await tablesDB.upsertRow({
		databaseId,
		tableId: 'archetypes',
		rowId: a.id,
		data: {
			name: a.name,
			tagline: a.tagline,
			traits_json: JSON.stringify(a.traits),
			priority: a.priority
		}
	});
	console.log(`archetypes/${a.id} upserted`);
}

console.log(`Seeded ${questions.length} questions and ${archetypes.length} archetypes.`);

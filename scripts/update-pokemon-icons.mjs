// 開発時のみ実行する辞書更新スクリプト。ページの実行時に外部APIは使いません。
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FORM_ALIASES } from '../assets/pokemon/form-aliases.js';
const POKEAPI = 'cd5f6c6232f23430aa6089896d96230f5f7ecef4';
const SHOWDOWN = '36ba1106bbb0e95b457e29a07b5f9e9db29ac85a';
const output = new URL('../assets/pokemon/', import.meta.url);
await mkdir(output, { recursive: true });
const get = async url => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
};
const files = ['pokemon_species_names.csv', 'pokemon_species.csv', 'pokemon.csv', 'pokemon_forms.csv', 'pokemon_form_names.csv'];
const inputs = await Promise.all(files.map(file => get(`https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI}/data/v2/csv/${file}`)));
const [indexSource, image] = await Promise.all([
  get(`https://raw.githubusercontent.com/smogon/pokemon-showdown-client/${SHOWDOWN}/play.pokemonshowdown.com/src/battle-dex-data.ts`),
  get('https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png')
]);

function csv(buffer) {
  const rows = buffer.toString('utf8').trim().split(/\r?\n/).map(line => line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(value => value.replace(/^"|"$/g, '').replaceAll('""', '"')));
  const headers = rows.shift();
  return rows.map(row => Object.fromEntries(headers.map((key, i) => [key, row[i] || ''])));
}
const [speciesNames, species, pokemon, forms, formNames] = inputs.map(csv);
const width = image.readUInt32BE(16), height = image.readUInt32BE(20);
if (width !== 480 || height % 30 !== 0) throw new Error('Unexpected sprite sheet dimensions');
const slots = width / 40 * (height / 30);
const indexes = new Map();
const sourceObject = indexSource.toString().split('export const BattlePokemonIconIndexes:')[1]?.split('};')[0];
if (!sourceObject) throw new Error('Icon index source not found');
for (const match of sourceObject.matchAll(/^\s*([a-z0-9]+):\s*(\d+)(?:\s*\+\s*(\d+))?,/gm)) {
  const index = Number(match[2]) + Number(match[3] || 0);
  if (index < slots) indexes.set(match[1], index);
}
const key = name => name.normalize('NFKC').toLowerCase().replace(/[\s()\[\]{}:・._\-/]/g, '').replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
const entries = new Map(), baseNames = new Map();
const add = (name, index) => { if (name && index > 0 && index < slots) entries.set(key(name), index); };
for (const row of speciesNames.filter(row => ['1', '11', '9'].includes(row.local_language_id))) {
  add(row.name, Number(row.pokemon_species_id));
  if (row.local_language_id === '11') baseNames.set(row.pokemon_species_id, row.name);
}
species.forEach(row => add(row.identifier, Number(row.id)));
const pokemonById = new Map(pokemon.map(row => [row.id, row]));
const localized = new Map(formNames.filter(row => row.local_language_id === '11').map(row => [row.pokemon_form_id, row]));
const iconId = identifier => identifier.replace(/^necrozma-dusk$/, 'necrozma-dusk-mane').replace(/^necrozma-dawn$/, 'necrozma-dawn-wings').replace(/-mask|-breed|-cap/g, '').replace(/-single-strike/g, '').replace(/-amped-gmax/g, '-gmax').replace(/-female/g, '-f').replace(/[^a-z0-9]/g, '');
const extraLabels = new Map([
  ['れいじゅうフォルム', ['れいじゅう', '霊獣']], ['けしんフォルム', ['けしん', '化身']],
  ['いちげきのかた', ['いちげき', '一撃']], ['れんげきのかた', ['れんげき', '連撃']],
  ['アカツキ', ['あかつき', '赫月']], ['みどりのめん', ['みどり']],
  ['いどのめん', ['いど', '井戸']], ['かまどのめん', ['かまど', '竈']], ['いしずえのめん', ['いしずえ', '礎']]
]);
for (const form of forms) {
  const mon = pokemonById.get(form.pokemon_id);
  if (!mon) continue;
  const base = baseNames.get(mon.species_id);
  if (!base) continue;
  const index = indexes.get(iconId(form.identifier)) ?? indexes.get(iconId(mon.identifier)) ?? Number(mon.species_id);
  add(form.identifier, index);
  if (form.is_default === '1') add(mon.identifier, index);
  const local = localized.get(form.id);
  if (!local?.form_name) continue;
  const description = local.form_name;
  if (description.includes(base)) add(description, index);
  if (local.pokemon_name) add(local.pokemon_name, index);
  const short = description.replace(base, '').replace(/のすがた$|フォルム$|のかた$|のめん$/g, '');
  for (const label of new Set([description, short, ...(extraLabels.get(description) || [])])) {
    if (!label) continue;
    add(`${base}(${label})`, index);
    add(`${label}${base}`, index);
  }
  const region = { alola: ['アローラ', 'A'], galar: ['ガラル', 'G'], hisui: ['ヒスイ', 'H'], paldea: ['パルデア', 'P'] };
  for (const [slug, labels] of Object.entries(region)) {
    if (form.form_identifier === slug) for (const label of labels) { add(`${base}(${label})`, index); add(`${label}${base}`, index); }
  }
}
// 日本語表記が未登録の別フォルム用の補助表記。
for (const [name, id] of [['ニドランメス', 29], ['ニドランオス', 32], ['オーガポン(みどりのめん)', 1017]]) add(name, id);
for (const [name, index] of Object.entries(FORM_ALIASES)) add(name, index);
const sorted = Object.fromEntries([...entries].sort(([a], [b]) => a.localeCompare(b)));
await writeFile(new URL('data.js', output), `// Generated by scripts/update-pokemon-icons.mjs. See SOURCES.md.\nexport const ICON_COLUMNS = 12;\nexport const ICON_SLOTS = ${slots};\nexport const POKEMON_ICONS = ${JSON.stringify(sorted)};\n`);
await writeFile(new URL('icons.png', output), image);
const hash = createHash('sha256').update(image).digest('hex');
await writeFile(new URL('SOURCES.md', output), `# Pokémon icon assets\n\n- Icon image: https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png\n- Icon layout data: https://github.com/smogon/pokemon-showdown-client/blob/${SHOWDOWN}/play.pokemonshowdown.com/src/battle-dex-data.ts\n- Pokémon names and forms: https://github.com/PokeAPI/pokeapi/tree/${POKEAPI}/data/v2/csv\n- Sprite contributors: https://github.com/smogon/sprites\n- Image SHA-256: ${hash}\n\nThe icon image is bundled unchanged. Pokémon characters and original game artwork belong to their respective rights holders, including Nintendo, Creatures, and GAME FREAK. Custom sprites belong to their respective contributors. This attribution does not claim a license to Pokémon artwork. The generated dictionary contains names, form aliases, and numeric sprite positions; no Pokémon Showdown application code is bundled.\n\nRun \`node scripts/update-pokemon-icons.mjs\` to regenerate. Review the upstream icon image and index together when updating. All icon lookup happens locally at runtime.\n`);
console.log(`Generated ${entries.size} icon aliases for ${baseNames.size} species; ${width}×${height} sprite sheet.`);

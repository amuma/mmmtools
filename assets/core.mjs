// KP = 採用した参加者数。入力・集計はネットワークアクセスを行わない純粋関数です。
export const HEADERS = ['参加者名', ...Array.from({ length: 6 }, (_, i) => `ポケモン${i + 1}`)];
export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_PLAYERS = 5000;
const collator = new Intl.Collator('ja', { numeric: true });
export const compareNames = (a, b) => collator.compare(a, b);
export const normalizePokemon = value => value.normalize('NFKC').trim();
export class CsvError extends Error {
  constructor(messages) { super(messages[0]); this.name = 'CsvError'; this.messages = messages; }
}

export function decodeCsv(buffer, encoding = 'auto') {
  const bytes = new Uint8Array(buffer);
  if (bytes.length > MAX_BYTES) throw new CsvError(['ファイルが5MBを超えています。分割して読み込んでください。']);
  if (!['auto', 'utf-8', 'shift_jis'].includes(encoding)) throw new CsvError(['文字コードの設定が不正です。']);
  if (bytes[0] === 0xff && bytes[1] === 0xfe || bytes[0] === 0xfe && bytes[1] === 0xff) {
    throw new CsvError(['UTF-16形式は読み込めません。UTF-8またはShift_JISのCSVとして保存してください。']);
  }
  const decode = value => {
    try { return { text: new TextDecoder(value, { fatal: true }).decode(bytes), encoding: value }; }
    catch { throw new CsvError([`${value === 'utf-8' ? 'UTF-8' : 'Shift_JIS'}として読み込めません。文字コードを変更するか、UTF-8のCSVとして保存してください。`]); }
  };
  if (encoding !== 'auto') return decode(encoding);
  try { return decode('utf-8'); } catch { return decode('shift_jis'); }
}

// 引用符・カンマ・CRLF・引用符内改行に対応。エラーには実ファイルの行番号を付けます。
export function parseCsv(text) {
  if (typeof text !== 'string' || !text.trim()) throw new CsvError(['CSVが空です。参加者のパーティを入力してください。']);
  text = text.replace(/^\uFEFF/, '');
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw new CsvError(['CSVに読み込めない制御文字があります。Excelファイルではなく、CSV形式で保存してください。']);
  const rows = [];
  let fields = [], field = '', quoted = false, closed = false, line = 1, rowLine = 1;
  const flushField = () => { fields.push(field); field = ''; closed = false; };
  const flushRow = () => {
    flushField();
    if (fields.some(value => value.trim())) rows.push({ cells: fields, line: rowLine });
    fields = [];
    if (rows.length > MAX_PLAYERS + 1) throw new CsvError([`参加者数は${MAX_PLAYERS.toLocaleString()}人までです。CSVを分割してください。`]);
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else {
        if (char === '\r' || char === '\n') {
          if (char === '\r' && text[i + 1] === '\n') i++;
          field += '\n'; line++;
        } else field += char;
      }
    } else if (char === ',') flushField();
    else if (char === '\r' || char === '\n') {
      flushRow(); if (char === '\r' && text[i + 1] === '\n') i++;
      line++; rowLine = line;
    } else if (char === '"') {
      if (field || closed) throw new CsvError([`${line}行目：引用符の位置が不正です。カンマを含むセルは全体を二重引用符で囲んでください。`]);
      quoted = true;
    } else if (closed) {
      if (char !== ' ' && char !== '\t') throw new CsvError([`${line}行目：閉じた引用符の後に文字があります。CSV形式を確認してください。`]);
    } else field += char;
  }
  if (quoted) throw new CsvError([`${rowLine}行目：引用符が閉じられていません。`]);
  flushRow();
  return rows;
}

export function validateRows(rows) {
  if (!rows.length) throw new CsvError(['参加者データがありません。']);
  const first = rows[0].cells.map(normalizePokemon);
  const hasHeader = first[0] === HEADERS[0];
  if (hasHeader && (first.length !== 7 || first.some((value, i) => value !== HEADERS[i]))) {
    throw new CsvError(['ヘッダーは「参加者名,ポケモン1,ポケモン2,ポケモン3,ポケモン4,ポケモン5,ポケモン6」の7列にしてください。']);
  }
  const dataRows = hasHeader ? rows.slice(1) : rows;
  if (!dataRows.length) throw new CsvError(['ヘッダーのみのCSVです。参加者データを追加してください。']);
  if (dataRows.length > MAX_PLAYERS) throw new CsvError([`参加者数は${MAX_PLAYERS.toLocaleString()}人までです。`]);
  const errors = [], names = new Set(), participants = [];
  for (const { cells, line } of dataRows) {
    if (cells.length !== 7) { errors.push(`${line}行目：${cells.length}列あります。参加者名とポケモン6匹の7列にしてください。`); continue; }
    const name = cells[0].trim();
    const party = cells.slice(1).map(normalizePokemon);
    if (!name) errors.push(`${line}行目：参加者名が空欄です。`);
    else if (names.has(name)) errors.push(`${line}行目：参加者名「${name}」が重複しています。識別できる名前にしてください。`);
    names.add(name);
    party.forEach((pokemon, i) => { if (!pokemon) errors.push(`${line}行目：ポケモン${i + 1}が空欄です。6匹すべて入力してください。`); });
    if (cells.some(value => value.length > 100)) errors.push(`${line}行目：100文字を超えるセルがあります。`);
    if (new Set(party.filter(Boolean)).size !== party.filter(Boolean).length) errors.push(`${line}行目：パーティ内に同じポケモンが重複しています。フォルムを分ける場合は名前に含めてください。`);
    participants.push({ name, party, sourceLine: line });
  }
  if (errors.length) throw new CsvError(errors.length > 20 ? [...errors.slice(0, 20), `ほか${errors.length - 20}件のエラーがあります。`] : errors);
  return { participants, hasHeader };
}

export function rankByKp(items, field) {
  const sorted = [...items].sort((a, b) => b[field] - a[field] || compareNames(a.name, b.name));
  let previous, rank;
  return sorted.map((item, index) => {
    if (item[field] !== previous) rank = index + 1;
    previous = item[field]; return { ...item, rank };
  });
}

export function aggregate(participants) {
  const counts = new Map();
  for (const player of participants) for (const pokemon of new Set(player.party)) counts.set(pokemon, (counts.get(pokemon) || 0) + 1);
  const pokemon = rankByKp([...counts].map(([name, kp]) => ({ name, kp, usage: kp / participants.length })), 'kp');
  const players = rankByKp(participants.map(player => {
    const partyKp = player.party.map(name => counts.get(name));
    return { ...player, partyKp, total: partyKp.reduce((sum, kp) => sum + kp, 0) };
  }), 'total');
  return { pokemon, players, totalPlayers: players.length, totalSpecies: pokemon.length };
}

export function analyzeCsv(text) {
  const parsed = validateRows(parseCsv(text));
  return { ...aggregate(parsed.participants), hasHeader: parsed.hasHeader };
}

export const SAMPLE_CSV = `${HEADERS.join(',')}\r\nたろう,カイリュー,ハバタクカミ,サーフゴー,パオジアン,ディンルー,オーガポン\r\nはなこ,カイリュー,ガチグマ,サーフゴー,ウーラオス,ゴリランダー,キュウコン\r\nけんた,ハバタクカミ,パオジアン,ディンルー,ガチグマ,ウーラオス,ドオー\r\nあおい,カイリュー,サーフゴー,オーガポン,ゴリランダー,キュウコン,ミミッキュ\r\nみなと,カイリュー,ハバタクカミ,パオジアン,ウーラオス,ガチグマ,ポリゴン2\r\nさくら,サーフゴー,ディンルー,ゴリランダー,オーガポン,ミミッキュ,ドオー\r\n`;

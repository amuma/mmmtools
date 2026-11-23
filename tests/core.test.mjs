import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { HEADERS, SAMPLE_CSV, analyzeCsv, parseCsv, decodeCsv, MAX_BYTES, MAX_PLAYERS, CsvError } from '../assets/core.js';
import { createWorkbook } from '../assets/workbook.js';
const require = createRequire(import.meta.url);
const ExcelJS = require('../assets/vendor/exceljs-4.4.0.min.js');
const header = HEADERS.join(',');
const row = 'たろう,カイリュー,ハバタクカミ,サーフゴー,パオジアン,ディンルー,オーガポン';
const invalid = (text, pattern) => assert.throws(() => analyzeCsv(text), error => error instanceof CsvError && error.messages.some(message => pattern.test(message)));

test('KPと参加者合計・採用率・同順位を計算する', () => {
  const data = analyzeCsv(SAMPLE_CSV);
  assert.equal(data.totalPlayers, 6); assert.equal(data.totalSpecies, 13);
  assert.equal(data.pokemon.find(p => p.name === 'カイリュー').kp, 4);
  assert.equal(data.pokemon.find(p => p.name === 'サーフゴー').usage, 4 / 6);
  assert.equal(data.players.find(p => p.name === 'たろう').total, 20);
  assert.equal(data.pokemon.filter(p => p.kp === 4).every(p => p.rank === 1), true);
  assert.equal(data.pokemon.filter(p => p.kp === 3).every(p => p.rank === 3), true);
  assert.equal(data.players.reduce((sum, p) => sum + p.total, 0), data.pokemon.reduce((sum, p) => sum + p.kp ** 2, 0));
  assert.equal(data.pokemon.reduce((sum, p) => sum + p.kp, 0), data.totalPlayers * 6);
});
test('BOM・CRLF・空行・ヘッダーなしに対応', () => {
  assert.equal(analyzeCsv(`\uFEFF${header}\r\n\r\n${row}\r\n`).totalPlayers, 1);
  assert.equal(analyzeCsv(row).hasHeader, false);
});
test('引用符内のカンマ・エスケープ・改行と物理行番号', () => {
  const rows = parseCsv('"田中, \"\"太郎\"\"\nさん",a,b,c,d,e,f\r\n次の人,a,b,c,d,e,f');
  assert.equal(rows[0].cells[0], '田中, "太郎"\nさん');
  assert.equal(rows[1].line, 3);
});
test('全半角を統一し、フォルムは分ける', () => {
  const data = analyzeCsv('A,ポリゴン２,ロトム(ウォッシュ),a,b,c,d\nB, ポリゴン2 ,ロトム,a,b,c,d');
  assert.equal(data.pokemon.find(p => p.name === 'ポリゴン2').kp, 2);
  assert.equal(data.pokemon.find(p => p.name === 'ロトム').kp, 1);
});
test('CSVの不正な引用符を拒否する', () => {
  invalid('"a,b,c', /引用符/); invalid('a"b,c', /引用符/); invalid('"a"z,b', /引用符/);
});
test('列数・ヘッダー・空データを検証する', () => {
  invalid('A,b,c', /7列/); invalid(`${row},余分`, /7列/);
  invalid('参加者名,ポケモン1', /ヘッダー/); invalid(header, /ヘッダーのみ/); invalid('\n', /空/);
});
test('空欄・参加者重複・パーティ内重複を拒否する', () => {
  invalid(',a,b,c,d,e,f', /参加者名が空欄/); invalid('A,a,b,c,d,e,', /ポケモン6/);
  invalid(`${row}\n${row}`, /参加者名.*重複/); invalid('A,ポリゴン2,ポリゴン２,c,d,e,f', /パーティ内/);
});
test('複数エラーを行番号付きで返す', () => {
  assert.throws(() => analyzeCsv(`${header}\nA,a,b\nB,a,b,c,d,e,`), error => error.messages.length === 2 && error.messages[0].startsWith('2行目') && error.messages[1].startsWith('3行目'));
});
test('UTF-8とShift_JISを自動判別する', () => {
  const utf8 = new TextEncoder().encode('参加者名');
  assert.equal(decodeCsv(utf8).encoding, 'utf-8');
  const sjis = Uint8Array.from([0x82, 0xa0, 0x82, 0xa2]);
  assert.equal(decodeCsv(sjis).text, 'あい'); assert.equal(decodeCsv(sjis).encoding, 'shift_jis');
  assert.throws(() => decodeCsv(sjis, 'utf-8'), CsvError);
});
test('UTF-16・制御文字・大きすぎるファイルを拒否する', () => {
  assert.throws(() => decodeCsv(Uint8Array.from([0xff, 0xfe, 0x41, 0])), /UTF-16/);
  assert.throws(() => decodeCsv(new Uint8Array(MAX_BYTES + 1)), /5MB/);
  invalid('A,\0,b,c,d,e,f', /制御文字/);
});
test('5,000人の集計と上限検証', () => {
  const rows = Array.from({ length: MAX_PLAYERS }, (_, i) => `参加者${i},a,b,c,d,e,f`);
  const data = analyzeCsv(rows.join('\n'));
  assert.equal(data.totalPlayers, 5000); assert.equal(data.players[0].total, 30000);
  invalid([...rows, '追加,a,b,c,d,e,f'].join('\n'), /5,000|5000/);
});
test('Excelを生成して再読込し、数値・順位・パーティと採用率を照合', async () => {
  const data = analyzeCsv(SAMPLE_CSV);
  const workbook = createWorkbook(data, ExcelJS, 'sample.csv');
  const output = await workbook.xlsx.writeBuffer();
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(output);
  assert.deepEqual(loaded.worksheets.map(s => s.name), ['参加者別KP', 'ポケモン別KP']);
  const players = loaded.worksheets[0], pokemon = loaded.worksheets[1];
  assert.equal(players.rowCount, 7); assert.equal(players.columnCount, 15);
  data.players.forEach((player, i) => {
    const cells = players.getRow(i + 2);
    assert.equal(cells.getCell(1).value, player.rank); assert.equal(cells.getCell(2).value, player.name);
    assert.equal(cells.getCell(3).value, player.total);
    player.party.forEach((name, j) => { assert.equal(cells.getCell(j * 2 + 4).value, name); assert.equal(cells.getCell(j * 2 + 5).value, player.partyKp[j]); });
  });
  assert.equal(pokemon.rowCount, 14);
  data.pokemon.forEach((item, i) => { assert.equal(pokemon.getCell(`C${i + 2}`).value, item.kp); assert.equal(pokemon.getCell(`D${i + 2}`).value, item.usage); });
  assert.equal(pokemon.getCell('D2').numFmt, '0.0%');
  assert.equal(players.views[0].ySplit, 1); assert.ok(pokemon.autoFilter);
});
test('入力のHTML・数式・URLを実行可能なデータに変換しない', async () => {
  // 引用符が含まれる名前をCSVの規則に従ってエスケープする。
  const values = ['=1+1', '<img src=x onerror=alert(1)>', '=HYPERLINK("x")', '@SUM(A1)', '+1', '-1', 'https://example.com'];
  const csv = values.map(v => `"${v.replaceAll('"', '""')}"`).join(',');
  const workbook = createWorkbook(analyzeCsv(csv), ExcelJS);
  const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  assert.equal(loaded.worksheets[0].getCell('B2').type, ExcelJS.ValueType.String);
  assert.equal(loaded.worksheets[0].getCell('B2').value, '=1+1');
  assert.equal(loaded.worksheets[0].getCell('F2').type, ExcelJS.ValueType.String);
  assert.equal(loaded.worksheets[0].getCell('N2').type, ExcelJS.ValueType.String);
});

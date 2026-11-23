import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPokemonIconIndex } from '../assets/pokemon-icons.js';
import { POKEMON_ICONS, ICON_SLOTS } from '../assets/pokemon/data.js';

test('初代から第9世代まで日本語名でアイコンを解決する', () => {
  for (const [name, index] of [['フシギダネ', 1], ['カイリュー', 149], ['サーフゴー', 1000], ['オーガポン', 1017], ['モモワロウ', 1025]]) {
    assert.equal(getPokemonIconIndex(name), index);
  }
});
test('全半角・英語・仮名の違いを表示用の辞書で吸収する', () => {
  assert.equal(getPokemonIconIndex(' ﾎﾟﾘｺﾞﾝ２ '), 233);
  assert.equal(getPokemonIconIndex('Dragonite'), 149);
  assert.equal(getPokemonIconIndex('かいりゅー'), 149);
});
test('主要なフォルムが通常種のアイコンと区別される', () => {
  for (const [name, index] of [['ロトム（ウォッシュ）', 1084], ['ウォッシュロトム', 1084], ['ランドロス(霊獣)', 1100], ['キュウコン(アローラ)', 1157], ['Aキュウコン', 1157], ['ガチグマ(アカツキ)', 1272], ['オーガポン(いどのめん)', 1273]]) {
    assert.equal(getPokemonIconIndex(name), index, name);
  }
});
test('未知の名前や任意のフォルムを別のポケモンに誤変換しない', () => {
  for (const name of ['未登録', 'カイリュー(未登録フォルム)', '__proto__', '<img src=x onerror=alert(1)>', '=1+1']) assert.equal(getPokemonIconIndex(name), null);
});
test('すべてのアイコンが同梱画像の範囲内にある', () => {
  const png = readFileSync(new URL('../assets/pokemon/icons.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 480);
  assert.equal(png.readUInt32BE(20) / 30 * 12, ICON_SLOTS);
  assert.ok(Object.keys(POKEMON_ICONS).length > 3000);
  assert.ok(Object.values(POKEMON_ICONS).every(index => Number.isInteger(index) && index > 0 && index < ICON_SLOTS));
});

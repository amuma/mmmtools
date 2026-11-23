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
test('指定された49種類の括弧表記を対応するフォルムへ解決する', () => {
  const groups = [
    ['ロトム', [['水', 'rotom-wash'], ['氷', 'rotom-frost'], ['火', 'rotom-heat'], ['飛', 'rotom-fan'], ['草', 'rotom-mow']]],
    ['デオキシス', [['アタック', 'deoxys-attack'], ['スピード', 'deoxys-speed'], ['ディフェンス', 'deoxys-defense'], ['ノーマル', 'deoxys-normal']]],
    ['ギラティナ', [['オリジン', 'giratina-origin'], ['アナザー', 'giratina-altered']]],
    ['ディアルガ', [['オリジン', 'dialga-origin']]],
    ['パルキア', [['オリジン', 'palkia-origin']]],
    ['オーガポン', [['みどり', 'ogerpon'], ['いど', 'ogerpon-wellspring-mask'], ['かまど', 'ogerpon-hearthflame-mask'], ['いしずえ', 'ogerpon-cornerstone-mask']]],
    ['トルネロス', [['けしん', 'tornadus-incarnate'], ['れいじゅう', 'tornadus-therian']]],
    ['ボルトロス', [['けしん', 'thundurus-incarnate'], ['れいじゅう', 'thundurus-therian']]],
    ['ランドロス', [['けしん', 'landorus-incarnate'], ['れいじゅう', 'landorus-therian']]],
    ['ラブトロス', [['けしん', 'enamorus-incarnate'], ['れいじゅう', 'enamorus-therian']]],
    ['キュレム', [['ブラック', 'kyurem-black'], ['ホワイト', 'kyurem-white']]],
    ['ネクロズマ', [['あかつき', 'necrozma-dawn'], ['たそがれ', 'necrozma-dusk']]],
    ['バドレックス', [['はくばじょう', 'calyrex-ice'], ['こくばじょう', 'calyrex-shadow']]],
    ['ミノムッチ', [['くさき', 'burmy-plant'], ['すなち', 'burmy-sandy'], ['ゴミ', 'burmy-trash']]],
    ['ミノマダム', [['くさき', 'wormadam-plant'], ['すなち', 'wormadam-sandy'], ['ゴミ', 'wormadam-trash']]],
    ['オドリドリ', [['ぱちぱち', 'oricorio-pom-pom'], ['ふらふら', 'oricorio-pau'], ['めらめら', 'oricorio-baile'], ['まいまい', 'oricorio-sensu']]],
    ['シキジカ', [['はる', 'deerling-spring'], ['なつ', 'deerling-summer'], ['あき', 'deerling-autumn'], ['ふゆ', 'deerling-winter']]],
    ['メブキジカ', [['はる', 'sawsbuck-spring'], ['なつ', 'sawsbuck-summer'], ['あき', 'sawsbuck-autumn'], ['ふゆ', 'sawsbuck-winter']]]
  ];
  let checked = 0;
  for (const [species, forms] of groups) {
    const indexes = [];
    for (const [form, canonical] of forms) {
      const input = `${species}（${form}）`;
      const index = getPokemonIconIndex(input);
      assert.notEqual(index, null, input);
      assert.equal(index, getPokemonIconIndex(canonical), input);
      assert.equal(index, getPokemonIconIndex(`${species}(${form})`), input);
      indexes.push(index); checked++;
    }
    assert.equal(new Set(indexes).size, forms.length, `${species}の各フォルムは異なる画像を使用する`);
  }
  assert.equal(checked, 49);
});
test('すべてのアイコンが同梱画像の範囲内にある', () => {
  const png = readFileSync(new URL('../assets/pokemon/icons.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), 480);
  assert.equal(png.readUInt32BE(20) / 30 * 12, ICON_SLOTS);
  assert.ok(Object.keys(POKEMON_ICONS).length > 3000);
  assert.ok(Object.values(POKEMON_ICONS).every(index => Number.isInteger(index) && index > 0 && index < ICON_SLOTS));
});

// ExcelJSは同梱ファイルから読み込みます。入力文字列を数式に変換しません。
export function createWorkbook(data, ExcelJS, sourceName = '') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'mmm tools';
  workbook.created = new Date();
  workbook.subject = 'ポケモンオフ会 KP集計';
  workbook.description = `入力：${sourceName} / KP＝採用参加者数（自身を含む） / 参加者別KP合計＝入力されたポケモンのKP合計（空欄を除く） / 採用率＝KP÷参加者数`;
  const participants = workbook.addWorksheet('参加者別KP', { views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }], properties: { tabColor: { argb: 'B3CD7C' } } });
  participants.columns = [
    { header: '順位', key: 'rank', width: 8 },
    { header: '参加者名', key: 'name', width: 22 },
    { header: 'KP合計', key: 'total', width: 12 },
    ...Array.from({ length: 6 }, (_, i) => [
      { header: `ポケモン${i + 1}`, key: `pokemon${i}`, width: 22 },
      { header: `KP${i + 1}`, key: `kp${i}`, width: 8 }
    ]).flat()
  ];
  for (const player of data.players) {
    const row = { rank: player.rank, name: player.name, total: player.total };
    player.party.forEach((name, i) => { row[`pokemon${i}`] = name || null; row[`kp${i}`] = name ? player.partyKp[i] : null; });
    participants.addRow(row);
  }
  const pokemon = workbook.addWorksheet('ポケモン別KP', { views: [{ state: 'frozen', ySplit: 1 }], properties: { tabColor: { argb: '6A8751' } } });
  pokemon.columns = [
    { header: '順位', key: 'rank', width: 8 }, { header: 'ポケモン名', key: 'name', width: 26 },
    { header: 'KP', key: 'kp', width: 12 }, { header: '採用率', key: 'usage', width: 14 }
  ];
  data.pokemon.forEach(item => pokemon.addRow({ rank: item.rank, name: item.name, kp: item.kp, usage: item.usage }));
  pokemon.getColumn('usage').numFmt = '0.0%';
  for (const sheet of [participants, pokemon]) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    sheet.eachRow((row, rowNumber) => {
      row.height = rowNumber === 1 ? 30 : 25;
      row.eachCell(cell => {
        cell.font = { name: 'Yu Gothic', size: 11, color: { argb: rowNumber === 1 ? 'FFFFFF' : '20291A' }, bold: rowNumber === 1 };
        cell.alignment = { vertical: 'middle', horizontal: typeof cell.value === 'number' ? 'right' : 'left' };
        if (rowNumber === 1 || rowNumber % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNumber === 1 ? '293322' : 'F0F4E9' } };
      });
    });
  }
  participants.getCell('C1').note = '入力されたポケモンそれぞれのKPの合計（空欄を除く）。KPはそのポケモンを採用した参加者数で、自分自身も含みます。';
  pokemon.getCell('C1').note = 'このポケモンを採用した参加者の数（自身を含む）。';
  pokemon.getCell('D1').note = `KP ÷ 参加者数（${data.totalPlayers}人）。`;
  return workbook;
}

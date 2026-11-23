import { analyzeCsv, decodeCsv, compareNames, normalizePokemon, SAMPLE_CSV, MAX_BYTES, CsvError } from './core.mjs';
import { createWorkbook } from './workbook.mjs';

const $ = id => document.getElementById(id);
const state = { data: null, tab: 'pokemon', page: 1, name: '', buffer: null, sample: false, busy: false, generation: 0 };
const PAGE_SIZE = 25;
const number = new Intl.NumberFormat('ja');
const percent = value => `${(value * 100).toFixed(1)}%`;

function feedback(messages, error = false) {
  const box = $('feedback'); box.replaceChildren(); box.hidden = !messages.length;
  box.classList.toggle('error', error);
  const title = document.createElement('p');
  title.textContent = error ? 'CSVを読み込めませんでした。' : messages[0];
  box.append(title);
  if (error) {
    const list = document.createElement('ul');
    messages.forEach(message => { const li = document.createElement('li'); li.textContent = message; list.append(li); });
    box.append(list);
  }
}

function setBusy(busy) {
  state.busy = busy;
  for (const id of ['choose-file', 'sample-button', 'empty-sample', 'encoding', 'reset-button']) $(id).disabled = busy;
  $('export-button').disabled = busy || !state.data;
  $('drop-zone').setAttribute('aria-busy', String(busy));
  $('export-label').textContent = busy && state.data ? 'Excelを作成中…' : 'Excelをダウンロード';
}

function reset() {
  state.generation++;
  Object.assign(state, { data: null, buffer: null, name: '', sample: false, page: 1 });
  $('csv-file').value = ''; $('search').value = ''; $('sort').value = 'desc';
  $('empty-state').hidden = false; $('result-content').hidden = true;
  $('table-body').replaceChildren(); $('file-name').textContent = '';
  feedback([]); setBusy(false);
}

function showResults(data, name, sample, encoding = '') {
  Object.assign(state, { data, name, sample, page: 1 });
  $('search').value = ''; $('sort').value = 'desc';
  $('empty-state').hidden = true; $('result-content').hidden = false;
  $('file-name').textContent = name; $('sample-tag').hidden = !sample;
  $('stat-players').textContent = number.format(data.totalPlayers);
  $('stat-species').textContent = number.format(data.totalSpecies);
  const leaders = data.pokemon.filter(item => item.rank === 1);
  $('stat-top').textContent = leaders[0].name + (leaders.length > 1 ? ` ほか${leaders.length - 1}種` : '');
  $('stat-top-detail').textContent = `KP ${leaders[0].kp} / 採用率 ${percent(leaders[0].usage)}`;
  feedback([`${sample ? 'サンプルの' : ''}${number.format(data.totalPlayers)}人のパーティを集計しました。${encoding ? `（${encoding === 'utf-8' ? 'UTF-8' : 'Shift_JIS'} / ${data.hasHeader ? 'ヘッダーあり' : 'ヘッダーなし'}）` : ''}`]);
  renderTable();
}

async function loadFile(file, reloadBuffer = null) {
  if (!file || state.busy) return;
  if (!/\.csv$/i.test(file.name)) { reset(); feedback(['拡張子が.csvのファイルを選択してください。Excelの場合はCSV形式で保存してください。'], true); return; }
  if (file.size > MAX_BYTES) { reset(); feedback(['ファイルが5MBを超えています。CSVを分割してください。'], true); return; }
  const generation = ++state.generation;
  setBusy(true); feedback(['CSVを読み込んでいます…']);
  try {
    const buffer = reloadBuffer || await file.arrayBuffer();
    if (generation !== state.generation) return;
    const decoded = decodeCsv(buffer, $('encoding').value);
    const data = analyzeCsv(decoded.text);
    state.buffer = buffer;
    showResults(data, file.name, false, decoded.encoding);
  } catch (error) {
    if (generation !== state.generation) return;
    // 読み込み失敗時は古い集計結果を残さず、誤ったExcelの出力を防ぎます。
    reset();
    feedback(error instanceof CsvError ? error.messages : ['ファイルを読み込めませんでした。CSVの内容と文字コードを確認してください。'], true);
  } finally { setBusy(false); }
}

function loadSample() {
  if (state.busy) return;
  state.generation++; state.buffer = null; $('csv-file').value = '';
  showResults(analyzeCsv(SAMPLE_CSV), 'sample.csv', true);
  setBusy(false);
}

function textCell(row, text, className = '') {
  const cell = document.createElement('td'); cell.textContent = text;
  if (className) cell.className = className;
  row.append(cell); return cell;
}

function renderTable() {
  if (!state.data) return;
  const isPokemon = state.tab === 'pokemon';
  const selected = isPokemon ? 'pokemon-tab' : 'players-tab';
  for (const id of ['pokemon-tab', 'players-tab']) { $(id).setAttribute('aria-selected', String(id === selected)); $(id).tabIndex = id === selected ? 0 : -1; }
  $('data-panel').setAttribute('aria-labelledby', selected);
  $('table-caption').textContent = isPokemon ? 'ポケモン別KP集計' : '参加者別KP合計';
  $('search').placeholder = isPokemon ? 'ポケモン名で検索' : '参加者・ポケモン名で検索';
  const key = isPokemon ? 'kp' : 'total';
  const query = normalizePokemon($('search').value).toLocaleLowerCase('ja');
  const all = isPokemon ? state.data.pokemon : state.data.players;
  const filtered = all.filter(item => normalizePokemon(`${item.name} ${item.party?.join(' ') || ''}`).toLocaleLowerCase('ja').includes(query));
  const sort = $('sort').value;
  filtered.sort((a, b) => sort === 'name' ? compareNames(a.name, b.name) : (sort === 'asc' ? a[key] - b[key] : b[key] - a[key]) || compareNames(a.name, b.name));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const offset = (state.page - 1) * PAGE_SIZE;
  const head = document.createElement('tr');
  const headers = isPokemon ? ['順位', 'ポケモン名', 'KP', '採用率'] : ['順位', '参加者名', 'KP合計', 'パーティ / 各ポケモンのKP'];
  headers.forEach((label, index) => { const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; if (index === 2 || isPokemon && index === 3) th.className = 'numeric'; head.append(th); });
  $('table-head').replaceChildren(head);
  const body = document.createDocumentFragment();
  for (const item of filtered.slice(offset, offset + PAGE_SIZE)) {
    const row = document.createElement('tr');
    textCell(row, number.format(item.rank), `rank${item.rank <= 3 ? ' rank-top' : ''}`);
    textCell(row, item.name);
    textCell(row, number.format(item[key]), 'numeric kp-value');
    if (isPokemon) {
      const cell = textCell(row, '', 'usage-cell');
      const container = document.createElement('div'); container.className = 'usage-content';
      const bar = document.createElement('span'); bar.className = 'usage-bar'; bar.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('i'); fill.style.width = percent(item.usage); bar.append(fill);
      const value = document.createElement('span'); value.className = 'usage-number'; value.textContent = percent(item.usage);
      container.append(bar, value); cell.append(container);
    } else {
      const cell = textCell(row, '', 'party-cell'); const party = document.createElement('div'); party.className = 'party-list';
      item.party.forEach((name, i) => { const label = document.createElement('span'); label.append(document.createTextNode(name)); const kp = document.createElement('small'); kp.textContent = `(${item.partyKp[i]})`; label.append(kp); party.append(label); });
      cell.append(party);
    }
    body.append(row);
  }
  $('table-body').replaceChildren(body);
  $('no-matches').hidden = filtered.length > 0;
  $('row-count').textContent = filtered.length ? `${number.format(offset + 1)}–${number.format(Math.min(offset + PAGE_SIZE, filtered.length))} / ${number.format(filtered.length)}件` : '0件';
  $('page-label').textContent = `${state.page} / ${pages}`;
  $('prev-page').disabled = state.page === 1; $('next-page').disabled = state.page === pages;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

$('choose-file').addEventListener('click', () => { $('csv-file').value = ''; $('csv-file').click(); });
$('csv-file').addEventListener('change', event => loadFile(event.target.files[0]));
$('sample-button').addEventListener('click', loadSample); $('empty-sample').addEventListener('click', loadSample);
$('reset-button').addEventListener('click', reset);
$('encoding').addEventListener('change', () => {
  if (state.buffer) loadFile({ name: state.name, size: state.buffer.byteLength }, state.buffer);
});
for (const id of ['search', 'sort']) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { state.page = 1; renderTable(); });
for (const [id, tab] of [['pokemon-tab', 'pokemon'], ['players-tab', 'players']]) {
  $(id).addEventListener('click', () => { state.tab = tab; state.page = 1; $('search').value = ''; renderTable(); });
  $(id).addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 'pokemon-tab' : event.key === 'End' ? 'players-tab' : id === 'pokemon-tab' ? 'players-tab' : 'pokemon-tab';
      $(next).click(); $(next).focus();
    }
  });
}
$('prev-page').addEventListener('click', () => { state.page--; renderTable(); });
$('next-page').addEventListener('click', () => { state.page++; renderTable(); });
for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) $('drop-zone').addEventListener(type, event => {
  event.preventDefault();
  $('drop-zone').classList.toggle('dragging', type === 'dragenter' || type === 'dragover');
  if (type === 'drop' && !state.busy) {
    const files = event.dataTransfer.files;
    if (files.length !== 1) { feedback(['CSVを1ファイルずつ読み込んでください。'], true); return; }
    loadFile(files[0]);
  }
});
// ドロップ領域外へのファイル投下によるブラウザの画面遷移を防ぎます。
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());
$('export-button').addEventListener('click', async () => {
  if (!state.data || state.busy) return;
  const data = state.data, sourceName = state.name;
  setBusy(true);
  try {
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
    if (!globalThis.ExcelJS) throw new Error('Excel library unavailable');
    const workbook = createWorkbook(data, globalThis.ExcelJS, sourceName);
    const buffer = await workbook.xlsx.writeBuffer();
    const date = new Date();
    const stamp = [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((n, i) => i ? String(n).padStart(2, '0') : n).join('');
    download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `mmm-tools_KP_${stamp}.xlsx`);
    feedback([`全${number.format(data.totalPlayers)}人の集計結果をExcelで出力しました。`]);
  } catch { feedback(['Excelを作成できませんでした。ページを再読み込みしてCSVを読み込み直してください。'], true); }
  finally { setBusy(false); }
});

import { POKEMON_ICONS, ICON_COLUMNS, ICON_SLOTS } from './pokemon/data.js?v=4';

// アイコン用の表記ゆれ吸収だけを行い、KP集計のグループ分けには影響させません。
export function iconNameKey(name) {
  return name.normalize('NFKC').toLowerCase()
    .replace(/[\s()\[\]{}:・._\-/]/g, '')
    .replace(/[ァ-ヶ]/g, char => String.fromCharCode(char.charCodeAt(0) - 0x60));
}

export function getPokemonIconIndex(name) {
  const key = iconNameKey(name);
  if (!Object.hasOwn(POKEMON_ICONS, key)) return null;
  const index = POKEMON_ICONS[key];
  return Number.isInteger(index) && index > 0 && index < ICON_SLOTS ? index : null;
}

export function createPokemonLabel(name) {
  const label = document.createElement('span');
  label.className = 'pokemon-label'; label.title = name;
  const icon = document.createElement('span');
  icon.className = 'pokemon-icon'; icon.setAttribute('aria-hidden', 'true');
  const index = getPokemonIconIndex(name);
  if (index === null) {
    icon.classList.add('pokemon-icon-unknown'); icon.textContent = '?';
  } else {
    icon.style.backgroundPosition = `-${(index % ICON_COLUMNS) * 40}px -${Math.floor(index / ICON_COLUMNS) * 30}px`;
  }
  const text = document.createElement('span'); text.className = 'pokemon-name'; text.textContent = name;
  label.append(icon, text);
  return label;
}

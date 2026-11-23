# Pokémon icon assets

- Icon image: https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png
- Icon layout data: https://github.com/smogon/pokemon-showdown-client/blob/36ba1106bbb0e95b457e29a07b5f9e9db29ac85a/play.pokemonshowdown.com/src/battle-dex-data.ts
- Pokémon names and forms: https://github.com/PokeAPI/pokeapi/tree/cd5f6c6232f23430aa6089896d96230f5f7ecef4/data/v2/csv
- Sprite contributors: https://github.com/smogon/sprites
- Image SHA-256: 81c713b8f4d94f7f577c546974e3d562d90b38c98b38b1b63b2a953b9acfca2a

The icon image is bundled unchanged. Pokémon characters and original game artwork belong to their respective rights holders, including Nintendo, Creatures, and GAME FREAK. Custom sprites belong to their respective contributors. This attribution does not claim a license to Pokémon artwork. The generated dictionary contains names, form aliases, and numeric sprite positions; no Pokémon Showdown application code is bundled.

Run `node scripts/update-pokemon-icons.mjs` to regenerate. Review the upstream icon image and index together when updating. All icon lookup happens locally at runtime.

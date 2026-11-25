// Blocks (placeable, id < 64) and items (id >= 64). Words live in content.js, keyed by `word`.
export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7,
  PLANKS: 8, GLASS: 9, BRICK: 10, SNOW: 11, CRYSTAL: 12, FLOWER_R: 13, FLOWER_Y: 14, METAL: 15,
  COAL_ORE: 16, IRON_ORE: 17, GOLD_ORE: 18, CLAY: 19, TORCH: 20, CHEST: 21, WOOL: 22, GOLD_BLOCK: 23, SAVANNA: 24,
  STUD_RED: 25, STUD_BLUE: 26, STUD_YELLOW: 27, STUD_GREEN: 28, STUD_WHITE: 29, STUD_BLACK: 30, MOON: 31,
};
export const I = { COAL: 64, IRON: 65, GOLD: 66, EGG: 67, PICK_WOOD: 70, PICK_STONE: 71, PICK_IRON: 72 };

// Atlas tile indices (see textures.js)
export const T = {
  grass_top: 0, grass_side: 1, dirt: 2, stone: 3, sand: 4, water: 5, log_side: 6, log_top: 7,
  leaves: 8, planks: 9, glass: 10, brick: 11, snow: 12, snow_side: 13, crystal: 14,
  flower_red: 15, flower_yellow: 16, metal: 17, coal_ore: 18, iron_ore: 19, gold_ore: 20, clay: 21,
  torch: 22, chest: 23, chest_top: 24, wool: 25, gold_block: 26, savanna_top: 27, savanna_side: 28,
  stud_red: 29, stud_red_side: 30, stud_blue: 31, stud_blue_side: 32, stud_yellow: 33, stud_yellow_side: 34,
  stud_green: 35, stud_green_side: 36, stud_white: 37, stud_white_side: 38, stud_black: 39, stud_black_side: 40, moon: 41,
};

const cube = (top, side = top, bottom = top) => ({ top, side, bottom });

// kind: 'cube' | 'water' | 'glass' | 'cross'
// hard: seconds to mine by hand; tier: pickaxe needed (0 none, 1 wood, 2 stone, 3 iron); rock: pickaxes speed it up
export const BLOCKS = [];
BLOCKS[B.AIR]      = { kind: 'air' };
BLOCKS[B.GRASS]    = { kind: 'cube', tiles: cube(T.grass_top, T.grass_side, T.dirt), word: 'gras', drop: B.DIRT, hard: 0.45 };
BLOCKS[B.DIRT]     = { kind: 'cube', tiles: cube(T.dirt), word: 'erde', hard: 0.4 };
BLOCKS[B.STONE]    = { kind: 'cube', tiles: cube(T.stone), word: 'stein', hard: 1.6, rock: true };
BLOCKS[B.SAND]     = { kind: 'cube', tiles: cube(T.sand), word: 'sand', hard: 0.35 };
BLOCKS[B.WATER]    = { kind: 'water', tiles: cube(T.water), word: 'wasser' };
BLOCKS[B.LOG]      = { kind: 'cube', tiles: cube(T.log_top, T.log_side, T.log_top), word: 'holz', hard: 0.9 };
BLOCKS[B.LEAVES]   = { kind: 'cube', tiles: cube(T.leaves), word: 'blaetter', hard: 0.15, drop: 0 };
BLOCKS[B.PLANKS]   = { kind: 'cube', tiles: cube(T.planks), word: 'bretter', hard: 0.7 };
BLOCKS[B.GLASS]    = { kind: 'glass', tiles: cube(T.glass), word: 'glas', hard: 0.3 };
BLOCKS[B.BRICK]    = { kind: 'cube', tiles: cube(T.brick), word: 'ziegel', hard: 1.4, rock: true };
BLOCKS[B.SNOW]     = { kind: 'cube', tiles: cube(T.snow, T.snow_side, T.dirt), word: 'schnee', hard: 0.3 };
BLOCKS[B.CRYSTAL]  = { kind: 'cube', tiles: cube(T.crystal), word: 'kristall', glow: true, hard: 1.2, rock: true };
BLOCKS[B.FLOWER_R] = { kind: 'cross', tiles: cube(T.flower_red), word: 'blume', hard: 0.05 };
BLOCKS[B.FLOWER_Y] = { kind: 'cross', tiles: cube(T.flower_yellow), word: 'blume', hard: 0.05 };
BLOCKS[B.METAL]    = { kind: 'cube', tiles: cube(T.metal), word: 'metall', hard: 2.2, rock: true, tier: 1 };
BLOCKS[B.COAL_ORE] = { kind: 'cube', tiles: cube(T.coal_ore), word: 'kohle', drop: I.COAL, hard: 1.8, rock: true, tier: 1 };
BLOCKS[B.IRON_ORE] = { kind: 'cube', tiles: cube(T.iron_ore), word: 'eisenerz', hard: 2.2, rock: true, tier: 2 };
BLOCKS[B.GOLD_ORE] = { kind: 'cube', tiles: cube(T.gold_ore), word: 'golderz', hard: 2.4, rock: true, tier: 3 };
BLOCKS[B.CLAY]     = { kind: 'cube', tiles: cube(T.clay), word: 'ton', hard: 0.45 };
BLOCKS[B.TORCH]    = { kind: 'cross', tiles: cube(T.torch), word: 'fackel', glow: true, hard: 0.05 };
BLOCKS[B.CHEST]    = { kind: 'cube', tiles: cube(T.chest_top, T.chest, T.chest_top), word: 'truhe', hard: 99, unbreakable: true };
BLOCKS[B.WOOL]     = { kind: 'cube', tiles: cube(T.wool), word: 'wolle', hard: 0.35 };
// dry savanna grass (the lions' home) — still 'das Gras'
BLOCKS[B.SAVANNA]  = { kind: 'cube', tiles: cube(T.savanna_top, T.savanna_side, T.dirt), word: 'gras', drop: B.DIRT, hard: 0.45 };
// colourful toy bricks with studs on top (generic building bricks, no brand)
for (const c of ['red', 'blue', 'yellow', 'green', 'white', 'black']) {
  const id = B['STUD_' + c.toUpperCase()], word = 'baustein_' + { red: 'rot', blue: 'blau', yellow: 'gelb', green: 'gruen', white: 'weiss', black: 'schwarz' }[c];
  BLOCKS[id] = { kind: 'cube', tiles: cube(T['stud_' + c], T['stud_' + c + '_side'], T['stud_' + c + '_side']), word, hard: 0.5 };
}
BLOCKS[B.MOON] = { kind: 'cube', tiles: cube(T.moon), word: 'mondgestein', hard: 1.2, rock: true };
BLOCKS[B.GOLD_BLOCK] = { kind: 'cube', tiles: cube(T.gold_block), word: 'goldblock', hard: 2, rock: true, tier: 1 };

// Non-placeable items
export const ITEMS = {
  [I.COAL]: { word: 'kohle' },
  [I.IRON]: { word: 'eisen' },
  [I.GOLD]: { word: 'gold' },
  [I.EGG]: { word: 'ei' },
  [I.PICK_WOOD]: { word: 'spitzhacke_holz', tool: 1 },
  [I.PICK_STONE]: { word: 'spitzhacke_stein', tool: 2 },
  [I.PICK_IRON]: { word: 'spitzhacke_eisen', tool: 3 },
};
export const isBlockItem = (id) => id > 0 && id < 64;
export const wordOf = (id) => (id < 64 ? BLOCKS[id]?.word : ITEMS[id]?.word);

export const isSolid = (id) => id !== B.AIR && id !== B.WATER && BLOCKS[id].kind !== 'cross';
export const isOpaque = (id) => BLOCKS[id].kind === 'cube';
export const isTargetable = (id) => id !== B.AIR && id !== B.WATER;

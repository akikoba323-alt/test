// Per-fighter material tables (linear albedo). kind: 0 skin, 1 cloth, 2 leather, 3 metal, 4 hair
const lin = (r, g, b) => [Math.pow(r / 255, 2.2), Math.pow(g / 255, 2.2), Math.pow(b / 255, 2.2)];

export const KAI_TABLE = [
  { albedo: lin(214, 174, 148), rough: 0.52, sss: 1.0, kind: 0 },                 // skin
  { albedo: lin(34, 36, 43), rough: 0.78, sheen: 0.45, kind: 1, tear: 1 },       // long coat
  { albedo: lin(46, 45, 49), rough: 0.86, sheen: 0.3, kind: 1, tear: 1 },        // trousers
  { albedo: lin(26, 23, 22), rough: 0.42, kind: 2 },                             // boots
  { albedo: lin(28, 25, 25), rough: 0.38, kind: 2 },                             // gloves / belt
  { albedo: lin(226, 229, 236), rough: 0.36, kind: 4 },                          // silver hair
  { albedo: lin(158, 16, 22), rough: 0.72, sheen: 0.6, kind: 1, tear: 0.6 },     // red scarf
  { albedo: lin(196, 196, 202), rough: 0.26, metal: 1, kind: 3 },                // steel
];

export const GOU_TABLE = [
  { albedo: lin(150, 104, 78), rough: 0.46, sss: 0.8, kind: 0 },                 // bronze skin (magma veins)
  { albedo: lin(36, 36, 44), rough: 0.88, sheen: 0.4, kind: 1, tear: 1 },        // baggy trousers
  { albedo: lin(118, 42, 30), rough: 0.85, sheen: 0.5, kind: 1, tear: 0.5 },     // sash and wraps
  { albedo: lin(44, 34, 29), rough: 0.6, kind: 2 },                              // wrapped leather feet
  { albedo: lin(30, 27, 26), rough: 0.5, kind: 2 },                              // spare leather
  { albedo: lin(28, 22, 20), rough: 0.6, kind: 4 },                              // brows / stubble
  { albedo: lin(58, 55, 52), rough: 0.55, metal: 0.85, kind: 3, emit: 1 },       // iron collar
  { albedo: lin(88, 84, 80), rough: 0.38, metal: 1, kind: 3, emit: 0.6 },        // blackened steel gauntlets
];

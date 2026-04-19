// COM Calculation Engine v4.4 — Industry-Standard Surface Area Method
// with live-configurable rules per piece type group from the database.
//
// All constants are read from an EngineRulesMap passed into the calculation.
// The Rules page allows the upholsterer to adjust these values per piece type.

// ─── Rule Defaults (fallback when rules haven't loaded yet) ─────
const DEFAULTS: Record<string, number> = {
  SEAM: 1,
  TUCK: 6,
  WRAP: 2,
  ARM_WIDTH: 8,
  SKIRT_DROP: 8,
  SKIRT_HEM: 2,
  SKIRT_PLEAT_MULTIPLIER: 1.5,
  WELT_BIAS_YIELD_FT_PER_YD: 78,
  WELT_MIN_YARDS: 0.5,
  // Per-group utilization (new key names)
  UTILIZATION: 0.70,
  UTIL_TIGHT_TIGHT: 0.55,
  UTIL_LOOSE_TIGHT: 0.74,
  UTIL_LOOSE_LOOSE: 0.62,
  // Legacy compat keys (mapped in buildRulesMap)
  CHAIR_UTILIZATION: 0.78,
  DINING_CHAIR_UTILIZATION: 0.70,
  SOFA_UTIL_TT: 0.55,
  SOFA_UTIL_LT: 0.74,
  SOFA_UTIL_LL: 0.62,
  TIGHT_BACK_PROFILE_PCT: 0.17,
  TIGHT_SEAT_PROFILE_MUL: 1.0,
  TIGHT_CROWN_WRAP: 4,
  YARDAGE_BUFFER: 0,
};

export type EngineRulesMap = Record<string, number>;

/** Merge loaded rules on top of hardcoded defaults */
export function buildRulesMap(dbRules: { key: string; value: number }[]): EngineRulesMap {
  const map = { ...DEFAULTS };
  for (const r of dbRules) {
    map[r.key] = r.value;
  }
  return map;
}

/** Get a rule value with fallback to default */
function R(rules: EngineRulesMap, key: string): number {
  return rules[key] ?? DEFAULTS[key] ?? 0;
}

// ─── Types ──────────────────────────────────────────────────────
export interface COMConfig {
  W: number;          // overall width
  D: number;          // overall depth  
  H: number;          // overall height (floor to top of frame)
  seatHeight: number;
  seatType: 'loose' | 'tight';
  backType: 'loose' | 'tight';
  base: 'upholstered' | 'wood_legs';
  skirt: boolean;
  arms: boolean;
  welting: boolean;
  nSeatCush: number;
  nBackCush: number;
  cushThick: number;
  fabricWidth: number;
  patternRepeat: number;
}

export interface COMResult {
  total: number;
  bodyYards: number;
  armsYards: number;
  cushionYards: number;
  bufferYards: number;
  panels: CutPiece[];
  totalSurfaceArea: number;
  wasteFactor: number;
}

export interface SectionalConfig extends COMConfig {
  returnLength: number;
}

export interface ChaiseConfig extends COMConfig {
  chaiseLength: number;
}

interface CutPiece {
  name: string;
  cutW: number;   // cut width including seam/tuck allowances
  cutH: number;   // cut height including seam/tuck allowances
  qty: number;
  category: 'body' | 'arms' | 'cushion';
}

// ─── Sofa-size detection ────────────────────────────────────────
const SOFA_PIECE_TYPES = new Set([
  'sofa', 'loveseat', 'sectional', 'chaise_end', 'daybed',
]);

function isSofaSize(pieceType: string, W: number): boolean {
  return SOFA_PIECE_TYPES.has(pieceType) || W >= 60;
}

function sofaUtilization(seatType: string, backType: string, rules: EngineRulesMap): number {
  // New per-group keys take priority; fall back to legacy keys
  if (seatType === 'tight' && backType === 'tight') {
    return rules['UTIL_TIGHT_TIGHT'] ?? R(rules, 'SOFA_UTIL_TT');
  }
  if (seatType === 'loose' && backType === 'loose') {
    return rules['UTIL_LOOSE_LOOSE'] ?? R(rules, 'SOFA_UTIL_LL');
  }
  return rules['UTIL_LOOSE_TIGHT'] ?? R(rules, 'SOFA_UTIL_LT');
}

// ─── Panel Enumeration ──────────────────────────────────────────

function enumeratePanels(config: COMConfig, pieceType: string, rules: EngineRulesMap): CutPiece[] {
  const { W, D, H, seatHeight, seatType, backType, base, arms,
          nSeatCush, nBackCush, cushThick } = config;

  const SEAM = R(rules, 'SEAM');
  const TUCK = R(rules, 'TUCK');
  const WRAP = R(rules, 'WRAP');
  const ARM_WIDTH = R(rules, 'ARM_WIDTH');

  const sofa = isSofaSize(pieceType, W);
  const effectiveArmW = (pieceType === 'dining_chair') ? 3 : ARM_WIDTH;

  const backH = H - seatHeight;
  const legH = base === 'wood_legs' ? 4 : 0;
  const insideW = arms ? W - (effectiveArmW * 2) : W;
  const deckD = D - 6;
  const pieces: CutPiece[] = [];

  const tightBackProfile = (backType === 'tight' && sofa)
    ? Math.round(D * R(rules, 'TIGHT_BACK_PROFILE_PCT')) : 0;

  const tightSeatProfile = (seatType === 'tight' && sofa)
    ? Math.round(cushThick * R(rules, 'TIGHT_SEAT_PROFILE_MUL')) : 0;

  const crownWrap = (backType === 'tight' && sofa) ? R(rules, 'TIGHT_CROWN_WRAP') : WRAP;

  // ─── BODY PANELS ────────────────────────────────────────────
  pieces.push({
    name: 'Outside Back',
    cutW: W + SEAM * 2,
    cutH: (H - legH) + crownWrap + SEAM * 2,
    qty: 1,
    category: 'body',
  });

  const sideTuck = arms
    ? (pieceType === 'dining_chair' ? 2 : TUCK)
    : (pieceType === 'dining_chair' ? 3 : 0);
  pieces.push({
    name: 'Inside Back',
    cutW: insideW + sideTuck * 2 + SEAM * 2,
    cutH: backH + tightBackProfile + crownWrap + TUCK + SEAM * 2,
    qty: 1,
    category: 'body',
  });

  pieces.push({
    name: 'Deck',
    cutW: insideW + sideTuck * 2 + SEAM * 2,
    cutH: deckD + tightSeatProfile + TUCK + SEAM * 2,
    qty: 1,
    category: 'body',
  });

  if (base === 'upholstered') {
    pieces.push({
      name: 'Front Rail',
      cutW: W + SEAM * 2,
      cutH: seatHeight + WRAP + SEAM * 2,
      qty: 1,
      category: 'body',
    });
  } else {
    const apronH = Math.max(seatHeight - legH, 4);
    pieces.push({
      name: 'Front Rail',
      cutW: W + SEAM * 2,
      cutH: apronH + SEAM * 2,
      qty: 1,
      category: 'body',
    });
  }

  if (pieceType === 'dining_chair') {
    const apronH = Math.max(seatHeight - legH, 4);
    pieces.push({
      name: 'Side Rail',
      cutW: deckD + SEAM * 2,
      cutH: apronH + SEAM * 2,
      qty: 2,
      category: 'body',
    });
    pieces.push({
      name: 'Back Rail',
      cutW: W + SEAM * 2,
      cutH: 4 + SEAM * 2,
      qty: 1,
      category: 'body',
    });
  }

  // ─── ARM PANELS ─────────────────────────────────────────────
  if (arms) {
    if (pieceType === 'dining_chair') {
      const armLen = D - 6;
      const armWrapH = backH + effectiveArmW;
      pieces.push({
        name: 'Arm Wrap',
        cutW: armLen + SEAM * 2,
        cutH: armWrapH + SEAM * 2,
        qty: 2,
        category: 'arms',
      });
    } else {
      const armDepth = D - 4;
      const iaProfileExtra = (backType === 'tight' && sofa) ? tightBackProfile : 0;
      pieces.push({
        name: 'Inside Arm',
        cutW: armDepth + SEAM * 2,
        cutH: backH + iaProfileExtra + TUCK + SEAM * 2,
        qty: 2,
        category: 'arms',
      });
      pieces.push({
        name: 'Outside Arm',
        cutW: armDepth + SEAM * 2,
        cutH: (H - legH) + SEAM * 2,
        qty: 2,
        category: 'arms',
      });
      pieces.push({
        name: 'Arm Front',
        cutW: ARM_WIDTH + 4 + SEAM * 2,
        cutH: (H - legH) + SEAM * 2,
        qty: 2,
        category: 'arms',
      });
      if (sofa) {
        pieces.push({
          name: 'Arm Top',
          cutW: armDepth + SEAM * 2,
          cutH: ARM_WIDTH + WRAP * 2 + SEAM * 2,
          qty: 2,
          category: 'arms',
        });
      }
    }
  }

  // ─── CUSHION PANELS ─────────────────────────────────────────
  if (seatType === 'loose' && nSeatCush > 0) {
    const cushW = insideW / nSeatCush;
    const cushD = deckD;
    pieces.push({
      name: 'Seat Cushion Top/Bottom',
      cutW: cushW + SEAM * 2,
      cutH: cushD + SEAM * 2,
      qty: nSeatCush * 2,
      category: 'cushion',
    });
    const perim = 2 * (cushW + cushD);
    pieces.push({
      name: 'Seat Cushion Boxing',
      cutW: perim + SEAM * 2,
      cutH: cushThick + SEAM * 2,
      qty: nSeatCush,
      category: 'cushion',
    });
  }

  if (backType === 'loose' && nBackCush > 0) {
    const cushW = insideW / nBackCush;
    const cushH = backH;
    pieces.push({
      name: 'Back Cushion Front/Back',
      cutW: cushW + SEAM * 2,
      cutH: cushH + SEAM * 2,
      qty: nBackCush * 2,
      category: 'cushion',
    });
    const backCushThick = Math.max(cushThick - 1, 3);
    const perim = 2 * (cushW + cushH);
    pieces.push({
      name: 'Back Cushion Boxing',
      cutW: perim + SEAM * 2,
      cutH: backCushThick + SEAM * 2,
      qty: nBackCush,
      category: 'cushion',
    });
  }

  return pieces;
}

// ─── Helpers ────────────────────────────────────────────────────

function areaToYards(totalArea: number, fabricWidth: number, utilization: number): number {
  return totalArea / (fabricWidth * 36) / utilization;
}

function sumArea(pieces: CutPiece[]): number {
  return pieces.reduce((sum, p) => sum + p.cutW * p.cutH * p.qty, 0);
}

const SMALL_PIECE_TYPES = new Set([
  'dining_chair', 'ottoman', 'bench', 'storage_bench',
  'drawer_fronts', 'headboard', 'outdoor_cushions',
]);

function roundYardage(yards: number, pieceType: string): number {
  if (SMALL_PIECE_TYPES.has(pieceType)) {
    return Math.ceil(yards * 4) / 4;
  }
  return Math.ceil(yards * 2) / 2;
}

function roundToHalfYard(yards: number): number {
  return Math.ceil(yards * 2) / 2;
}

// ─── Skirt Yardage ──────────────────────────────────────────────

function calculateSkirtYardage(config: COMConfig, fabricWidth: number, rules: EngineRulesMap): number {
  if (!config.skirt) return 0;
  const { W, D } = config;
  const SEAM = R(rules, 'SEAM');
  const perimeter = 2 * (W + D);
  const pleatPerimeter = perimeter * R(rules, 'SKIRT_PLEAT_MULTIPLIER');
  const cutHeight = R(rules, 'SKIRT_DROP') + R(rules, 'SKIRT_HEM') + SEAM * 2;
  const numCuts = Math.ceil(pleatPerimeter / fabricWidth);
  return (numCuts * cutHeight) / 36;
}

// ─── Welting Yardage ────────────────────────────────────────────

function calculateWeltingYardage(
  config: COMConfig, pieceType: string, sofa: boolean, rules: EngineRulesMap
): number {
  if (!config.welting) {
    if (sofa) {
      const weltScale = Math.max(config.W, 20) / 84;
      return -(0.5 * weltScale);
    }
    return 0;
  }
  if (sofa) return 0;

  const { W, D, H, seatHeight, arms } = config;
  const backH = H - seatHeight;
  let weltLinearInches = 0;

  if (pieceType === 'dining_chair') {
    const seatPerim = 2 * (W + (D - 6));
    const backBorder = 2 * W + 2 * backH;
    weltLinearInches = seatPerim + backBorder;
    if (arms) weltLinearInches += 2 * (D - 6 + backH);
  } else {
    const seatPerim = 2 * (W + (D - 6));
    const backBorder = 2 * W + 2 * backH;
    weltLinearInches = seatPerim + backBorder;
    if (arms) weltLinearInches += 4 * (D - 4 + backH);
  }

  const weltLinearFeet = weltLinearInches / 12;
  const fabricWidth = config.fabricWidth || 54;
  const yieldFtPerYd = R(rules, 'WELT_BIAS_YIELD_FT_PER_YD') * (fabricWidth / 54);
  const rawYds = weltLinearFeet / yieldFtPerYd;
  return Math.max(rawYds, R(rules, 'WELT_MIN_YARDS'));
}

// ─── Main Calculation ───────────────────────────────────────────

function calculateSinglePiece(config: COMConfig, pieceType: string, rules: EngineRulesMap): COMResult {
  const fabricWidth = config.fabricWidth || 54;
  const pieces = enumeratePanels(config, pieceType, rules);

  const sofa = isSofaSize(pieceType, config.W);
  // Per-group rules: 'UTILIZATION' is the primary key; sofa-family groups
  // also have TT/LT/LL variants that override based on seat/back type.
  let utilization: number;
  if (sofa && (rules['UTIL_TIGHT_TIGHT'] !== undefined || rules['SOFA_UTIL_TT'] !== undefined)) {
    utilization = sofaUtilization(config.seatType, config.backType, rules);
  } else {
    // Non-sofa or group without TT/LT/LL variants → use the single UTILIZATION key
    utilization = rules['UTILIZATION']
      ?? (pieceType === 'dining_chair' ? R(rules, 'DINING_CHAIR_UTILIZATION') : R(rules, 'CHAIR_UTILIZATION'));
  }

  const totalArea = sumArea(pieces);
  const rawYards = areaToYards(totalArea, fabricWidth, utilization);
  const skirtYards = calculateSkirtYardage(config, fabricWidth, rules);
  const weltingYards = calculateWeltingYardage(config, pieceType, sofa, rules);
  const totalRaw = rawYards + skirtYards + weltingYards;

  let patternMultiplier = 1;
  if (config.patternRepeat > 0) {
    patternMultiplier = 1 + (config.patternRepeat / 36) * 0.5;
  }

  const adjusted = totalRaw * patternMultiplier;
  const baseTotal = Math.max(roundYardage(adjusted, pieceType), 1.5);
  const buffer = R(rules, 'YARDAGE_BUFFER');
  const total = baseTotal + buffer;

  const bodyPieces = pieces.filter(p => p.category === 'body');
  const armPieces = pieces.filter(p => p.category === 'arms');
  const cushionPieces = pieces.filter(p => p.category === 'cushion');

  return {
    total,
    bodyYards: Math.round(areaToYards(sumArea(bodyPieces), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    armsYards: Math.round(areaToYards(sumArea(armPieces), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    cushionYards: Math.round(areaToYards(sumArea(cushionPieces), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    bufferYards: buffer,
    panels: pieces,
    totalSurfaceArea: totalArea,
    wasteFactor: 1 / utilization - 1,
  };
}

// ─── Sectional ──────────────────────────────────────────────────
function calculateSectional(config: SectionalConfig, rules: EngineRulesMap): COMResult {
  const { returnLength, D, W, ...rest } = config;
  const fabricWidth = rest.fabricWidth || 54;
  const SEAM = R(rules, 'SEAM');
  const TUCK = R(rules, 'TUCK');

  const utilization = sofaUtilization(rest.seatType, rest.backType, rules);

  const sectionAConfig: COMConfig = { ...rest, W, D, arms: true };
  const sectionAPieces = enumeratePanels(sectionAConfig, 'sectional', rules);
  const cornerArmNames = ['Inside Arm', 'Outside Arm', 'Arm Front', 'Arm Top'];
  const adjustedAPieces = sectionAPieces.map(p =>
    cornerArmNames.includes(p.name) && p.qty >= 2 ? { ...p, qty: p.qty - 1 } : p
  );

  const effectiveReturnW = returnLength - D;
  const sectionBConfig: COMConfig = { ...rest, W: effectiveReturnW, D, arms: true };
  const sectionBPieces = enumeratePanels(sectionBConfig, 'sectional', rules);
  const adjustedBPieces = sectionBPieces.map(p =>
    cornerArmNames.includes(p.name) && p.qty >= 2 ? { ...p, qty: p.qty - 1 } : p
  );

  const backH = rest.H - rest.seatHeight;
  const deckD = D - 6;
  const cornerPieces: CutPiece[] = [
    { name: 'Corner Inside Back', cutW: D + SEAM * 2, cutH: backH + TUCK + SEAM * 2, qty: 1, category: 'body' },
    { name: 'Corner Deck', cutW: D + SEAM * 2, cutH: deckD + TUCK + SEAM * 2, qty: 1, category: 'body' },
    { name: 'Corner Front Rail', cutW: D + SEAM * 2, cutH: rest.seatHeight + SEAM * 2, qty: 1, category: 'body' },
  ];

  if (rest.seatType === 'loose' && rest.nSeatCush > 0) {
    cornerPieces.push(
      { name: 'Corner Seat Cush Top/Bot', cutW: D + SEAM * 2, cutH: deckD + SEAM * 2, qty: 2, category: 'cushion' },
    );
    const perim = 2 * (D + deckD);
    cornerPieces.push(
      { name: 'Corner Seat Cush Boxing', cutW: perim + SEAM * 2, cutH: rest.cushThick + SEAM * 2, qty: 1, category: 'cushion' },
    );
  }
  if (rest.backType === 'loose' && rest.nBackCush > 0) {
    cornerPieces.push(
      { name: 'Corner Back Cush Fr/Bk', cutW: D + SEAM * 2, cutH: backH + SEAM * 2, qty: 2, category: 'cushion' },
    );
    const backCushThick = Math.max(rest.cushThick - 1, 3);
    const perim = 2 * (D + backH);
    cornerPieces.push(
      { name: 'Corner Back Cush Boxing', cutW: perim + SEAM * 2, cutH: backCushThick + SEAM * 2, qty: 1, category: 'cushion' },
    );
  }

  const allPieces = [
    ...adjustedAPieces.map(p => ({ ...p, name: `Main: ${p.name}` })),
    ...adjustedBPieces.map(p => ({ ...p, name: `Return: ${p.name}` })),
    ...cornerPieces,
  ];

  const totalArea = sumArea(allPieces);
  const rawYards = areaToYards(totalArea, fabricWidth, utilization);
  const weltCredit = !rest.welting ? -(0.5 * Math.max(W + returnLength, 20) / 84) : 0;
  const sectionalSkirtConfig = { ...rest, W: W + returnLength, D } as COMConfig;
  const skirtYards = calculateSkirtYardage(sectionalSkirtConfig, fabricWidth, rules);
  const totalRaw = rawYards + weltCredit + skirtYards;

  let patternMultiplier = 1;
  if (rest.patternRepeat > 0) {
    patternMultiplier = 1 + (rest.patternRepeat / 36) * 0.5;
  }

  const adjusted = totalRaw * patternMultiplier;
  const baseTotal = roundToHalfYard(adjusted);
  const buffer = R(rules, 'YARDAGE_BUFFER');
  const total = baseTotal + buffer;

  const bodyArr = allPieces.filter(p => p.category === 'body');
  const armArr = allPieces.filter(p => p.category === 'arms');
  const cushArr = allPieces.filter(p => p.category === 'cushion');

  return {
    total,
    bodyYards: Math.round(areaToYards(sumArea(bodyArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    armsYards: Math.round(areaToYards(sumArea(armArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    cushionYards: Math.round(areaToYards(sumArea(cushArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    bufferYards: buffer,
    panels: allPieces,
    totalSurfaceArea: totalArea,
    wasteFactor: 1 / utilization - 1,
  };
}

// ─── Chaise End ─────────────────────────────────────────────────
function calculateChaise(config: ChaiseConfig, rules: EngineRulesMap): COMResult {
  const { chaiseLength, D, W, ...rest } = config;
  const fabricWidth = rest.fabricWidth || 54;
  const SEAM = R(rules, 'SEAM');
  const TUCK = R(rules, 'TUCK');

  const utilization = sofaUtilization(rest.seatType, rest.backType, rules);

  const mainConfig: COMConfig = { ...rest, W, D, arms: true };
  const mainPieces = enumeratePanels(mainConfig, 'chaise_end', rules);
  const cornerArmNames = ['Inside Arm', 'Outside Arm', 'Arm Front', 'Arm Top'];
  const adjustedMainPieces = mainPieces.map(p =>
    cornerArmNames.includes(p.name) && p.qty >= 2 ? { ...p, qty: p.qty - 1 } : p
  );

  const chaiseW = chaiseLength - D;
  const chaiseConfig: COMConfig = { ...rest, W: chaiseW, D, arms: false };
  const chaisePieces = enumeratePanels(chaiseConfig, 'chaise_end', rules);

  const backH = rest.H - rest.seatHeight;
  const deckD = D - 6;
  const junctionPieces: CutPiece[] = [
    { name: 'Junction Inside Back', cutW: D + SEAM * 2, cutH: backH + TUCK + SEAM * 2, qty: 1, category: 'body' },
    { name: 'Junction Deck', cutW: D + SEAM * 2, cutH: deckD + TUCK + SEAM * 2, qty: 1, category: 'body' },
  ];

  if (rest.seatType === 'loose' && rest.nSeatCush > 0) {
    junctionPieces.push(
      { name: 'Junction Seat Cush Top/Bot', cutW: D + SEAM * 2, cutH: deckD + SEAM * 2, qty: 2, category: 'cushion' },
    );
    const perim = 2 * (D + deckD);
    junctionPieces.push(
      { name: 'Junction Seat Cush Boxing', cutW: perim + SEAM * 2, cutH: rest.cushThick + SEAM * 2, qty: 1, category: 'cushion' },
    );
  }

  const allPieces = [
    ...adjustedMainPieces.map(p => ({ ...p, name: `Main: ${p.name}` })),
    ...chaisePieces.map(p => ({ ...p, name: `Chaise: ${p.name}` })),
    ...junctionPieces,
  ];

  const totalArea = sumArea(allPieces);
  const rawYards = areaToYards(totalArea, fabricWidth, utilization);
  const chaiseWeltCredit = !rest.welting ? -(0.5 * Math.max(W + chaiseLength, 20) / 84) : 0;
  const chaiseSkirtConfig = { ...rest, W: W + chaiseLength, D } as COMConfig;
  const chaiseSkirtYards = calculateSkirtYardage(chaiseSkirtConfig, fabricWidth, rules);
  const totalRaw = rawYards + chaiseWeltCredit + chaiseSkirtYards;

  let patternMultiplier = 1;
  if (rest.patternRepeat > 0) {
    patternMultiplier = 1 + (rest.patternRepeat / 36) * 0.5;
  }

  const adjusted = totalRaw * patternMultiplier;
  const baseTotal = roundToHalfYard(adjusted);
  const buffer = R(rules, 'YARDAGE_BUFFER');
  const total = baseTotal + buffer;

  const bodyArr = allPieces.filter(p => p.category === 'body');
  const armArr = allPieces.filter(p => p.category === 'arms');
  const cushArr = allPieces.filter(p => p.category === 'cushion');

  return {
    total,
    bodyYards: Math.round(areaToYards(sumArea(bodyArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    armsYards: Math.round(areaToYards(sumArea(armArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    cushionYards: Math.round(areaToYards(sumArea(cushArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    bufferYards: buffer,
    panels: allPieces,
    totalSurfaceArea: totalArea,
    wasteFactor: 1 / utilization - 1,
  };
}

// ─── Public API ─────────────────────────────────────────────────

export function calculateCOM(
  config: COMConfig,
  pieceType: string,
  returnLength?: number,
  chaiseLength?: number,
  rules: EngineRulesMap = DEFAULTS,
): COMResult {
  if (pieceType === 'sectional' && returnLength) {
    return calculateSectional({ ...config, returnLength }, rules);
  }
  if (pieceType === 'chaise_end' && chaiseLength) {
    return calculateChaise({ ...config, chaiseLength }, rules);
  }
  return calculateSinglePiece(config, pieceType, rules);
}

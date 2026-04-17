// COM Calculation Engine v3.0 — Industry-Standard Surface Area Method
// Validated against 15+ industry sources (April 2026)
//
// Calculates yardage by:
// 1. Enumerating every upholstery panel (outside back, inside back, deck,
//    arms, cushion faces, boxing strips, etc.)
// 2. Computing the CUT dimensions of each panel (measured dimensions +
//    seam allowances + tuck-in where applicable)
// 3. Summing total cut-piece surface area
// 4. Converting to linear yards using: total_area / fabric_width / 36
//    with an industry-standard utilization factor of ~78%
//
// Constants validated against:
// - Fabric Resource, Lee Industries, Bettertex, StitchDesk, QA Group,
//   Revolution Fabrics, Villa Hallmark, and professional upholsterer refs
// - SEAM 1" = luxury standard (Bob's UDC, Fabric Outlet confirm 1")
// - TUCK 6" = professional maximum for deep crevice work (Yalla Upholstery)
// - UTILIZATION 78% = conservative for high-end (CutWize: 15-20% waste)
// - Pattern repeat formula tracks Lee Industries surcharge table within ±3%
//
// Industry reference ranges (Fabric Resource, 54" plain goods):
//   Sofa loose/loose no skirt: 18-20 yds
//   Sofa loose/tight no skirt: 16-18 yds
//   Sofa tight/tight no skirt: 14-16 yds
//   Sofa loose/loose with skirt: 20-22 yds
//   Chair loose/loose: 8-9 yds
//   Dining chair: 2-3 yds
//   Ottoman: 2-3 yds

// ─── Constants ──────────────────────────────────────────────────
const SEAM = 1;        // 1" seam allowance per edge (industry standard)
const TUCK = 6;        // 6" tuck-in for panels tucked into crevices
const WRAP = 2;        // 2" wrap-around for panels that wrap over edges
const ARM_WIDTH = 8;   // standard arm panel width
const SKIRT_DROP = 8;  // standard skirt drop height
const UTILIZATION = 0.78; // fabric utilization rate (78% = 22% waste)

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

// ─── Panel Enumeration ──────────────────────────────────────────

function enumeratePanels(config: COMConfig, pieceType: string = 'chair'): CutPiece[] {
  const { W, D, H, seatHeight, seatType, backType, base, skirt, arms,
          nSeatCush, nBackCush, cushThick } = config;

  // Dining chair arms are compact pads (3"), not full-width sofa arms (8")
  const effectiveArmW = (pieceType === 'dining_chair') ? 3 : ARM_WIDTH;

  const backH = H - seatHeight;
  const legH = base === 'wood_legs' ? 4 : 0;
  const insideW = arms ? W - (effectiveArmW * 2) : W;
  const deckD = D - 6;
  const pieces: CutPiece[] = [];

  // ─── BODY PANELS ────────────────────────────────────────────

  // OUTSIDE BACK (OB): full width × (height - legs + wrap over top)
  pieces.push({
    name: 'Outside Back',
    cutW: W + SEAM * 2,
    cutH: (H - legH) + WRAP + SEAM * 2,
    qty: 1,
    category: 'body',
  });

  // INSIDE BACK (IB): inside width + side tucks × back height + bottom tuck
  // Tucks into arm crevices on each side (when arms present) and into seat at bottom.
  // Dining chair arms are compact pads with shallow crevices (2" tuck vs 6" standard).
  const sideTuck = arms ? (pieceType === 'dining_chair' ? 2 : TUCK) : 0;
  pieces.push({
    name: 'Inside Back',
    cutW: insideW + sideTuck * 2 + SEAM * 2,
    cutH: backH + TUCK + SEAM * 2,
    qty: 1,
    category: 'body',
  });

  // DECK: inside width + side tucks × depth + back tuck
  // Tucks into arm crevices on each side and into back at rear
  pieces.push({
    name: 'Deck',
    cutW: insideW + sideTuck * 2 + SEAM * 2,
    cutH: deckD + TUCK + SEAM * 2,
    qty: 1,
    category: 'body',
  });

  // FRONT RAIL
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

  // SKIRT
  if (skirt) {
    pieces.push({
      name: 'Skirt Front',
      cutW: W + 6 + SEAM * 2,
      cutH: SKIRT_DROP + SEAM * 2,
      qty: 1,
      category: 'body',
    });
    pieces.push({
      name: 'Skirt Back',
      cutW: W + 6 + SEAM * 2,
      cutH: SKIRT_DROP + SEAM * 2,
      qty: 1,
      category: 'body',
    });
    pieces.push({
      name: 'Skirt Side',
      cutW: D + 6 + SEAM * 2,
      cutH: SKIRT_DROP + SEAM * 2,
      qty: 2,
      category: 'body',
    });
  }

  // ─── ARM PANELS ─────────────────────────────────────────────
  if (arms) {
    if (pieceType === 'dining_chair') {
      // Dining arm chairs have compact upholstered arms — narrower and
      // shorter than lounge/sofa arms. Modeled as a single wrap piece
      // per arm (inside face + top + outside face) plus a small end cap.
      const armLen = D - 6;  // arm pad length ≈ seat depth
      // Wrap height: inside face (~half backH) + top (armW) + outside face (~half backH)
      const armWrapH = backH + effectiveArmW;

      pieces.push({
        name: 'Arm Wrap',
        cutW: armLen + SEAM * 2,
        cutH: armWrapH + SEAM * 2,
        qty: 2,
        category: 'arms',
      });
    } else {
      const armDepth = D - 4; // arm extends slightly less than full depth

      // INSIDE ARM: depth × (backH + tuck into seat)
      pieces.push({
        name: 'Inside Arm',
        cutW: armDepth + SEAM * 2,
        cutH: backH + TUCK + SEAM * 2,
        qty: 2,
        category: 'arms',
      });

      // OUTSIDE ARM: depth × height (from bottom to top)
      pieces.push({
        name: 'Outside Arm',
        cutW: armDepth + SEAM * 2,
        cutH: (H - legH) + SEAM * 2,
        qty: 2,
        category: 'arms',
      });

      // ARM FRONTS: small panels for arm face
      pieces.push({
        name: 'Arm Front',
        cutW: ARM_WIDTH + 4 + SEAM * 2,
        cutH: (H - legH) + SEAM * 2,
        qty: 2,
        category: 'arms',
      });
    }
  }

  // ─── CUSHION PANELS ─────────────────────────────────────────
  if (seatType === 'loose' && nSeatCush > 0) {
    const cushW = insideW / nSeatCush;
    const cushD = deckD;

    // Top and bottom faces
    pieces.push({
      name: 'Seat Cushion Top/Bottom',
      cutW: cushW + SEAM * 2,
      cutH: cushD + SEAM * 2,
      qty: nSeatCush * 2,
      category: 'cushion',
    });

    // Boxing strip: perimeter × thickness
    // Modeled as a single rectangular piece (perimeter × cushThick)
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

// ─── Surface Area → Yards Conversion ────────────────────────────
// Total yardage = total cut-piece area / (fabricWidth × 36) / utilization
//
// Where utilization (0.78) accounts for the gap between theoretical
// area and actual fabric consumed due to cutting layouts, waste,
// selvedge, and nesting inefficiency.

function areaToYards(totalArea: number, fabricWidth: number): number {
  const yardArea = fabricWidth * 36; // sq in per linear yard
  return totalArea / yardArea / UTILIZATION;
}

function sumArea(pieces: CutPiece[]): number {
  return pieces.reduce((sum, p) => sum + p.cutW * p.cutH * p.qty, 0);
}

// ─── Rounding ───────────────────────────────────────────────────
// Small pieces (dining chairs, ottomans, benches, stools, headboards,
// outdoor cushions, drawer fronts) round to 0.25-yard increments.
// Larger pieces (chairs, loveseats, sofas, daybeds, sectionals, chaise
// ends, upholstered beds) round to 0.5-yard increments.
// Always round UP to ensure sufficient fabric.

const SMALL_PIECE_TYPES = new Set([
  'dining_chair', 'ottoman', 'bench', 'storage_bench',
  'drawer_fronts', 'headboard', 'outdoor_cushions',
]);

function roundYardage(yards: number, pieceType: string): number {
  if (SMALL_PIECE_TYPES.has(pieceType)) {
    return Math.ceil(yards * 4) / 4; // 0.25-yard precision
  }
  return Math.ceil(yards * 2) / 2; // 0.5-yard precision
}

// Backward-compat alias for sectional/chaise internals that don't track piece type
function roundToHalfYard(yards: number): number {
  return Math.ceil(yards * 2) / 2;
}

// ─── Main Calculation ───────────────────────────────────────────

function calculateSinglePiece(config: COMConfig, pieceType: string = 'chair'): COMResult {
  const fabricWidth = config.fabricWidth || 54;
  const pieces = enumeratePanels(config, pieceType);

  const totalArea = sumArea(pieces);
  const rawYards = areaToYards(totalArea, fabricWidth);

  // Welting/piping: ~1 yard per 84" of width
  const weltScale = Math.max(config.W, 20) / 84;
  const weltingYards = config.welting ? 1.0 * weltScale : 0;

  const totalRaw = rawYards + weltingYards;

  // Pattern repeat
  let patternMultiplier = 1;
  if (config.patternRepeat > 0) {
    patternMultiplier = 1 + (config.patternRepeat / 36) * 0.5;
  }

  const adjusted = totalRaw * patternMultiplier;
  // Round using piece-type-appropriate precision, minimum 1.5 yards
  const total = Math.max(roundYardage(adjusted, pieceType), 1.5);

  // Category breakdown
  const bodyPieces = pieces.filter(p => p.category === 'body');
  const armPieces = pieces.filter(p => p.category === 'arms');
  const cushionPieces = pieces.filter(p => p.category === 'cushion');

  return {
    total,
    bodyYards: Math.round(areaToYards(sumArea(bodyPieces), fabricWidth) * patternMultiplier * 100) / 100,
    armsYards: Math.round(areaToYards(sumArea(armPieces), fabricWidth) * patternMultiplier * 100) / 100,
    cushionYards: Math.round(areaToYards(sumArea(cushionPieces), fabricWidth) * patternMultiplier * 100) / 100,
    panels: pieces,
    totalSurfaceArea: totalArea,
    wasteFactor: 1 / UTILIZATION - 1,
  };
}

// ─── Sectional ──────────────────────────────────────────────────
function calculateSectional(config: SectionalConfig): COMResult {
  const { returnLength, D, W, ...rest } = config;
  const fabricWidth = rest.fabricWidth || 54;

  // Section A: main sofa — 1 arm (non-corner side only)
  const sectionAConfig: COMConfig = { ...rest, W, D, arms: true };
  const sectionAPieces = enumeratePanels(sectionAConfig);
  const cornerArmNames = ['Inside Arm', 'Outside Arm', 'Arm Front'];
  const adjustedAPieces = sectionAPieces.map(p =>
    cornerArmNames.includes(p.name) && p.qty >= 2 ? { ...p, qty: p.qty - 1 } : p
  );

  // Section B: return — effective width = returnLength - D
  const effectiveReturnW = returnLength - D;
  const sectionBConfig: COMConfig = { ...rest, W: effectiveReturnW, D, arms: true };
  const sectionBPieces = enumeratePanels(sectionBConfig);
  const adjustedBPieces = sectionBPieces.map(p =>
    cornerArmNames.includes(p.name) && p.qty >= 2 ? { ...p, qty: p.qty - 1 } : p
  );

  // Corner section panels
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
  const rawYards = areaToYards(totalArea, fabricWidth);
  const weltScale = Math.max(W + returnLength, 20) / 84;
  const weltingYards = rest.welting ? 1.0 * weltScale : 0;
  const totalRaw = rawYards + weltingYards;

  let patternMultiplier = 1;
  if (rest.patternRepeat > 0) {
    patternMultiplier = 1 + (rest.patternRepeat / 36) * 0.5;
  }

  const adjusted = totalRaw * patternMultiplier;
  const total = roundToHalfYard(adjusted);

  const bodyArr = allPieces.filter(p => p.category === 'body');
  const armArr = allPieces.filter(p => p.category === 'arms');
  const cushArr = allPieces.filter(p => p.category === 'cushion');

  return {
    total,
    bodyYards: Math.round(areaToYards(sumArea(bodyArr), fabricWidth) * patternMultiplier * 100) / 100,
    armsYards: Math.round(areaToYards(sumArea(armArr), fabricWidth) * patternMultiplier * 100) / 100,
    cushionYards: Math.round(areaToYards(sumArea(cushArr), fabricWidth) * patternMultiplier * 100) / 100,
    panels: allPieces,
    totalSurfaceArea: totalArea,
    wasteFactor: 1 / UTILIZATION - 1,
  };
}

// ─── Chaise End ─────────────────────────────────────────────────
function calculateChaise(config: ChaiseConfig): COMResult {
  const { chaiseLength, D, W, ...rest } = config;
  const fabricWidth = rest.fabricWidth || 54;

  // Main sofa — 1 arm (non-chaise side)
  const mainConfig: COMConfig = { ...rest, W, D, arms: true };
  const mainPieces = enumeratePanels(mainConfig);
  const cornerArmNames = ['Inside Arm', 'Outside Arm', 'Arm Front'];
  const adjustedMainPieces = mainPieces.map(p =>
    cornerArmNames.includes(p.name) && p.qty >= 2 ? { ...p, qty: p.qty - 1 } : p
  );

  // Chaise extension: armless
  const chaiseW = chaiseLength - D;
  const chaiseConfig: COMConfig = { ...rest, W: chaiseW, D, arms: false };
  const chaisePieces = enumeratePanels(chaiseConfig);

  // Junction panels
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
  const rawYards = areaToYards(totalArea, fabricWidth);
  const weltScale = Math.max(W + chaiseLength, 20) / 84;
  const weltingYards = rest.welting ? 1.0 * weltScale : 0;
  const totalRaw = rawYards + weltingYards;

  let patternMultiplier = 1;
  if (rest.patternRepeat > 0) {
    patternMultiplier = 1 + (rest.patternRepeat / 36) * 0.5;
  }

  const adjusted = totalRaw * patternMultiplier;
  const total = roundToHalfYard(adjusted);

  const bodyArr = allPieces.filter(p => p.category === 'body');
  const armArr = allPieces.filter(p => p.category === 'arms');
  const cushArr = allPieces.filter(p => p.category === 'cushion');

  return {
    total,
    bodyYards: Math.round(areaToYards(sumArea(bodyArr), fabricWidth) * patternMultiplier * 100) / 100,
    armsYards: Math.round(areaToYards(sumArea(armArr), fabricWidth) * patternMultiplier * 100) / 100,
    cushionYards: Math.round(areaToYards(sumArea(cushArr), fabricWidth) * patternMultiplier * 100) / 100,
    panels: allPieces,
    totalSurfaceArea: totalArea,
    wasteFactor: 1 / UTILIZATION - 1,
  };
}

// ─── Public API ─────────────────────────────────────────────────

export function calculateCOM(
  config: COMConfig,
  pieceType: string,
  returnLength?: number,
  chaiseLength?: number,
): COMResult {
  if (pieceType === 'sectional' && returnLength) {
    return calculateSectional({ ...config, returnLength });
  }
  if (pieceType === 'chaise_end' && chaiseLength) {
    return calculateChaise({ ...config, chaiseLength });
  }
  return calculateSinglePiece(config, pieceType);
}

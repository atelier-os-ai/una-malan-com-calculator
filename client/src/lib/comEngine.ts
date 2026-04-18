// COM Calculation Engine v4.2 — Industry-Standard Surface Area Method
// Validated against high-end manufacturer COM specs (April 2026)
//
// Calculates yardage by:
// 1. Enumerating every upholstery panel (outside back, inside back, deck,
//    arms, arm tops, cushion faces, boxing strips, etc.)
// 2. Computing the CUT dimensions of each panel (measured dimensions +
//    seam allowances + tuck-in + 3D profile wrapping where applicable)
// 3. Summing total cut-piece surface area
// 4. Converting to linear yards using: total_area / fabric_width / 36
//    with construction-dependent utilization factors
//
// Constants validated against:
// - Dmitriy Brampton (tight/tight, 72-120", wood base)
// - HollyHunt Isley (tight/tight, 109", sculpted wood base)
// - HollyHunt Rhone (loose/loose, 96-122", wood base)
// - Hickory Chair Alexander (loose/tight, 88", upholstered)
// - Fabric Resource generic ranges, Lee Industries, Bettertex, StitchDesk
// - SEAM 1" = luxury standard (Bob's UDC, Fabric Outlet confirm 1")
// - TUCK 6" = professional maximum for deep crevice work (Yalla Upholstery)
// - Sofa utilization 55-74% = high-end furniture (panels often >54", seaming waste)
// - Chair utilization 78% = standard (smaller panels nest well)
// - Pattern repeat formula tracks Lee Industries surcharge table within ±3%
//
// Industry reference ranges (54" plain goods):
//   Sofa loose/loose no skirt: 18-20 yds (Fabric Resource)
//   Sofa loose/tight no skirt: 16-18 yds (Fabric Resource)
//   Sofa tight/tight no skirt: 14-16 yds (Fabric Resource)
//   High-end TT 108": ~17 yds (Dmitriy, HollyHunt)
//   High-end LL 96": ~25 yds (HollyHunt Rhone)
//   Chair loose/loose: 8-9 yds
//   Dining chair: 2-3 yds
//   Ottoman: 2-3 yds

// ─── Constants ──────────────────────────────────────────────────
const SEAM = 1;        // 1" seam allowance per edge (industry standard)
const TUCK = 6;        // 6" tuck-in for panels tucked into crevices
const WRAP = 2;        // 2" wrap-around for panels that wrap over edges
const ARM_WIDTH = 8;   // standard arm panel width
const SKIRT_DROP = 8;  // standard skirt drop height
const SKIRT_HEM = 2;   // hem + turn-under allowance for skirt bottom
const SKIRT_PLEAT_MULTIPLIER = 1.5; // kick pleat (most common high-end)
// Pleat multipliers: kick=1.5, box=2.5, gathered=2.5-3.0, straight/banded=1.1
// We default to kick pleat as it's standard for high-end French furniture.

// Welting: bias-cut strips from 54" fabric yield ~78 linear feet per yard.
// Minimum 0.5 yards for any welted piece (practical cutting floor).
const WELT_BIAS_YIELD_FT_PER_YD = 78; // linear feet of bias-cut welt per yard of 54" fabric
const WELT_MIN_YARDS = 0.5; // minimum practical welting yardage

// Utilization rates: the fraction of fabric bolt area that becomes usable cut pieces.
// Sofa panels are often wider than the 54" bolt, requiring seaming with significant waste.
// The construction type determines the mix of wide body panels vs narrower cushion panels.
// Chair-size panels fit within a single fabric width, yielding much better utilization.
const CHAIR_UTILIZATION = 0.78; // 22% waste — lounge chairs, ottomans, etc.
const DINING_CHAIR_UTILIZATION = 0.70; // 30% waste — small irregular panels on curved frames

// Sofa utilization varies by construction — validated against 13 high-end benchmarks.
// These rates are calibrated WITH welting included (manufacturer COM specs include welting).
// When welting is toggled off for sofa-size pieces, a small credit is subtracted.
// - TT (tight/tight): ALL panels are wide body panels → most seaming waste
// - LT (loose/tight): mix of body panels + narrower seat cushion panels
// - LL (loose/loose): mix of body + seat cushion + back cushion panels
const SOFA_UTIL_TT = 0.55;  // tight seat + tight back: 45% waste
const SOFA_UTIL_LT = 0.74;  // loose seat + tight back: 26% waste
const SOFA_UTIL_LL = 0.62;  // loose seat + loose back: 38% waste

// For sofa-size tight-back pieces, the inside back fabric wraps around
// the 3D back frame profile (the back frame has depth/curvature).
// This adds to the cut height of body panels.
const TIGHT_BACK_PROFILE_PCT = 0.17; // % of overall depth added to IB height
const TIGHT_SEAT_PROFILE_MUL = 1.0;  // multiplier × cushion thickness for seat wrap
const TIGHT_CROWN_WRAP = 4;          // crown wrap for tight backs (vs 2" standard)

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

// ─── Sofa-size detection ────────────────────────────────────────
const SOFA_PIECE_TYPES = new Set([
  'sofa', 'loveseat', 'sectional', 'chaise_end', 'daybed',
]);

function isSofaSize(pieceType: string, W: number): boolean {
  return SOFA_PIECE_TYPES.has(pieceType) || W >= 60;
}

function sofaUtilization(seatType: string, backType: string): number {
  if (seatType === 'tight' && backType === 'tight') return SOFA_UTIL_TT;
  if (seatType === 'loose' && backType === 'loose') return SOFA_UTIL_LL;
  return SOFA_UTIL_LT; // mixed (loose/tight or tight/loose)
}

// ─── Panel Enumeration ──────────────────────────────────────────

function enumeratePanels(config: COMConfig, pieceType: string = 'chair'): CutPiece[] {
  const { W, D, H, seatHeight, seatType, backType, base, skirt, arms,
          nSeatCush, nBackCush, cushThick } = config;

  const sofa = isSofaSize(pieceType, W);

  // Dining chair arms are compact pads (3"), not full-width sofa arms (8")
  const effectiveArmW = (pieceType === 'dining_chair') ? 3 : ARM_WIDTH;

  const backH = H - seatHeight;
  const legH = base === 'wood_legs' ? 4 : 0;
  const insideW = arms ? W - (effectiveArmW * 2) : W;
  const deckD = D - 6;
  const pieces: CutPiece[] = [];

  // For sofa-size tight-back pieces: inside back wraps around back frame
  // curvature — the frame has depth, and the fabric follows the 3D profile.
  // This adds to the cut height of the inside back and inside arm panels.
  const tightBackProfile = (backType === 'tight' && sofa)
    ? Math.round(D * TIGHT_BACK_PROFILE_PCT) : 0;

  // For sofa-size tight-seat pieces: deck fabric wraps over foam/batting crown.
  const tightSeatProfile = (seatType === 'tight' && sofa)
    ? Math.round(cushThick * TIGHT_SEAT_PROFILE_MUL) : 0;

  // Crown wrap: how much the outside back wraps over the top rail.
  // Tight backs have a thicker rail requiring more wrap.
  const crownWrap = (backType === 'tight' && sofa) ? TIGHT_CROWN_WRAP : WRAP;

  // ─── BODY PANELS ────────────────────────────────────────────

  // OUTSIDE BACK (OB): full width × (height - legs + crown wrap over top)
  pieces.push({
    name: 'Outside Back',
    cutW: W + SEAM * 2,
    cutH: (H - legH) + crownWrap + SEAM * 2,
    qty: 1,
    category: 'body',
  });

  // INSIDE BACK (IB): inside width + side tucks × back height + profile depth + crown wrap + bottom tuck
  // Tucks into arm crevices on each side (when arms present) and into seat at bottom.
  // Dining chair arms are compact pads with shallow crevices (2" tuck vs 6" standard).
  // Armless dining chairs still get a 3" frame-crevice tuck where IB/deck meet the frame.
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

  // DECK: inside width + side tucks × depth + seat profile + back tuck
  // Tucks into arm crevices on each side and into back at rear
  pieces.push({
    name: 'Deck',
    cutW: insideW + sideTuck * 2 + SEAM * 2,
    cutH: deckD + tightSeatProfile + TUCK + SEAM * 2,
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

  // SKIRT — calculated separately as strip-cut yardage, NOT as area panels.
  // Skirts are cut as strips across the bolt width. The pleat style multiplies
  // the perimeter of fabric needed. This is added as direct yardage later,
  // not run through the area → utilization formula.
  // (See calculateSkirtYardage function below)

  // ─── DINING CHAIR EXTRA PANELS ─────────────────────────────
  // Dining chairs have upholstered side rails (left/right apron panels between legs)
  // and a back rail (top edge of back frame). These are small but add meaningful area.
  // Sofas don't need these because arm panels cover the sides.
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
      cutH: 4 + SEAM * 2,  // ~4" deep top rail
      qty: 1,
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

      // INSIDE ARM: depth × (backH + tight profile extra + tuck into seat)
      // For tight-back sofas, inside arm wraps deeper into the back-arm junction
      const iaProfileExtra = (backType === 'tight' && sofa) ? tightBackProfile : 0;
      pieces.push({
        name: 'Inside Arm',
        cutW: armDepth + SEAM * 2,
        cutH: backH + iaProfileExtra + TUCK + SEAM * 2,
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

      // ARM TOP: sofa-size pieces have a separate top-of-arm panel
      // that wraps over the arm rail. Not present on chairs.
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
// Where utilization accounts for the gap between theoretical area and
// actual fabric consumed due to cutting layouts, seaming waste,
// selvedge, and nesting inefficiency.
//
// Sofa panels are typically wider than the 54" fabric bolt, requiring
// seaming with 26-45% waste depending on construction type.
// Chair panels fit within a single bolt width with only ~22% waste.

function areaToYards(totalArea: number, fabricWidth: number, utilization: number): number {
  const yardArea = fabricWidth * 36; // sq in per linear yard
  return totalArea / yardArea / utilization;
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

// ─── Skirt Yardage (strip-cutting method) ───────────────────────
// Skirts are cut as horizontal strips from the bolt. The pleat style
// determines how much extra linear fabric is needed beyond the raw perimeter.
// Method: perimeter × pleat_multiplier → divide by fabric_width → count cuts
// → multiply by cut_height → convert to yards.
//
// Industry references:
//   Kim's Upholstery: kick pleat adds ~2 yds to a sofa
//   StitchDesk: box pleat sofa 3-3.5 yds, gathered 3.75-5 yds
//   Fabric Resource: "with skirt + 1 yard" for chair ottoman

function calculateSkirtYardage(config: COMConfig, fabricWidth: number): number {
  if (!config.skirt) return 0;
  const { W, D } = config;
  const perimeter = 2 * (W + D); // full 4-sided perimeter
  const pleatPerimeter = perimeter * SKIRT_PLEAT_MULTIPLIER;
  const cutHeight = SKIRT_DROP + SKIRT_HEM + SEAM * 2; // drop + hem + top/bottom seams
  const numCuts = Math.ceil(pleatPerimeter / fabricWidth);
  return (numCuts * cutHeight) / 36;
}

// ─── Welting Yardage (bias-cut strip method) ────────────────────
// Welting is cut as bias strips from the fabric. The total linear footage
// of welting depends on which seams are welted.
//
// Industry references (StitchDesk):
//   Sofa (full welt): 25-35 linear feet → 0.32-0.45 yds bias-cut
//   Chair: 12-18 linear feet → 0.15-0.23 yds bias-cut
//   Dining chair: 3-6 linear feet → practical minimum 0.5 yds
//   Chameleon Style: "3/4 of a yard gives you 15 yards of welting"
//   Minimum practical: 0.5 yds (can't efficiently bias-cut from less)
//
// For sofa-size pieces: welting is already baked into the calibrated
// utilization rates (manufacturer specs include welting). So we only
// apply a credit when welting is toggled OFF.

function calculateWeltingYardage(
  config: COMConfig, pieceType: string, sofa: boolean
): number {
  if (!config.welting) {
    // For sofas: return a negative credit when welting is off
    if (sofa) {
      const weltScale = Math.max(config.W, 20) / 84;
      return -(0.5 * weltScale);
    }
    return 0;
  }

  // For sofa-size pieces: welting is baked into utilization, no addition
  if (sofa) return 0;

  // For chair-size pieces: calculate actual welting linear footage
  const { W, D, H, seatHeight, arms } = config;
  const backH = H - seatHeight;

  // Welted seam locations vary by piece type:
  // - Seat border (perimeter of seat/deck)
  // - Back border (perimeter of back panel)
  // - Arm seams (if arms present)
  let weltLinearInches = 0;

  if (pieceType === 'dining_chair') {
    // Dining chair: seat perimeter + back panel border
    const seatPerim = 2 * (W + (D - 6)); // front/back + sides of seat
    const backBorder = 2 * W + 2 * backH; // around the back panel
    weltLinearInches = seatPerim + backBorder;
    if (arms) {
      weltLinearInches += 2 * (D - 6 + backH); // arm seam lines × 2
    }
  } else {
    // Lounge chair / other: seat + back + arm seams
    const seatPerim = 2 * (W + (D - 6));
    const backBorder = 2 * W + 2 * backH;
    weltLinearInches = seatPerim + backBorder;
    if (arms) {
      // Arm seams: inside arm join + outside arm join + arm front border
      weltLinearInches += 4 * (D - 4 + backH); // generous for 2 arms
    }
  }

  const weltLinearFeet = weltLinearInches / 12;
  const fabricWidth = config.fabricWidth || 54;
  // Scale yield by actual fabric width vs reference 54"
  const yieldFtPerYd = WELT_BIAS_YIELD_FT_PER_YD * (fabricWidth / 54);
  const rawYds = weltLinearFeet / yieldFtPerYd;

  // Enforce minimum — you can't practically bias-cut from less than ~0.5 yds
  return Math.max(rawYds, WELT_MIN_YARDS);
}

// ─── Main Calculation ───────────────────────────────────────────

function calculateSinglePiece(config: COMConfig, pieceType: string = 'chair'): COMResult {
  const fabricWidth = config.fabricWidth || 54;
  const pieces = enumeratePanels(config, pieceType);

  // Select utilization based on piece type and construction
  const sofa = isSofaSize(pieceType, config.W);
  const utilization = sofa
    ? sofaUtilization(config.seatType, config.backType)
    : pieceType === 'dining_chair'
      ? DINING_CHAIR_UTILIZATION
      : CHAIR_UTILIZATION;

  const totalArea = sumArea(pieces);
  const rawYards = areaToYards(totalArea, fabricWidth, utilization);

  // Skirt yardage: calculated via strip-cutting method (not area panels)
  const skirtYards = calculateSkirtYardage(config, fabricWidth);

  // Welting yardage: calculated via bias-cut linear footage method
  const weltingYards = calculateWeltingYardage(config, pieceType, sofa);

  const totalRaw = rawYards + skirtYards + weltingYards;

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
    bodyYards: Math.round(areaToYards(sumArea(bodyPieces), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    armsYards: Math.round(areaToYards(sumArea(armPieces), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    cushionYards: Math.round(areaToYards(sumArea(cushionPieces), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    panels: pieces,
    totalSurfaceArea: totalArea,
    wasteFactor: 1 / utilization - 1,
  };
}

// ─── Sectional ──────────────────────────────────────────────────
function calculateSectional(config: SectionalConfig): COMResult {
  const { returnLength, D, W, ...rest } = config;
  const fabricWidth = rest.fabricWidth || 54;

  // Sectionals are always sofa-size
  const utilization = sofaUtilization(rest.seatType, rest.backType);

  // Section A: main sofa — 1 arm (non-corner side only)
  const sectionAConfig: COMConfig = { ...rest, W, D, arms: true };
  const sectionAPieces = enumeratePanels(sectionAConfig, 'sectional');
  const cornerArmNames = ['Inside Arm', 'Outside Arm', 'Arm Front', 'Arm Top'];
  const adjustedAPieces = sectionAPieces.map(p =>
    cornerArmNames.includes(p.name) && p.qty >= 2 ? { ...p, qty: p.qty - 1 } : p
  );

  // Section B: return — effective width = returnLength - D
  const effectiveReturnW = returnLength - D;
  const sectionBConfig: COMConfig = { ...rest, W: effectiveReturnW, D, arms: true };
  const sectionBPieces = enumeratePanels(sectionBConfig, 'sectional');
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
  const rawYards = areaToYards(totalArea, fabricWidth, utilization);
  // Sectional welting: baked into sofa utilization (welting=on is baseline)
  const weltCredit = !rest.welting ? -(0.5 * Math.max(W + returnLength, 20) / 84) : 0;
  // Sectional skirt
  const sectionalSkirtConfig = { ...rest, W: W + returnLength, D } as COMConfig;
  const skirtYards = calculateSkirtYardage(sectionalSkirtConfig, fabricWidth);
  const totalRaw = rawYards + weltCredit + skirtYards;

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
    bodyYards: Math.round(areaToYards(sumArea(bodyArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    armsYards: Math.round(areaToYards(sumArea(armArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    cushionYards: Math.round(areaToYards(sumArea(cushArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    panels: allPieces,
    totalSurfaceArea: totalArea,
    wasteFactor: 1 / utilization - 1,
  };
}

// ─── Chaise End ─────────────────────────────────────────────────
function calculateChaise(config: ChaiseConfig): COMResult {
  const { chaiseLength, D, W, ...rest } = config;
  const fabricWidth = rest.fabricWidth || 54;

  // Chaises are always sofa-size
  const utilization = sofaUtilization(rest.seatType, rest.backType);

  // Main sofa — 1 arm (non-chaise side)
  const mainConfig: COMConfig = { ...rest, W, D, arms: true };
  const mainPieces = enumeratePanels(mainConfig, 'chaise_end');
  const cornerArmNames = ['Inside Arm', 'Outside Arm', 'Arm Front', 'Arm Top'];
  const adjustedMainPieces = mainPieces.map(p =>
    cornerArmNames.includes(p.name) && p.qty >= 2 ? { ...p, qty: p.qty - 1 } : p
  );

  // Chaise extension: armless
  const chaiseW = chaiseLength - D;
  const chaiseConfig: COMConfig = { ...rest, W: chaiseW, D, arms: false };
  const chaisePieces = enumeratePanels(chaiseConfig, 'chaise_end');

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
  const rawYards = areaToYards(totalArea, fabricWidth, utilization);
  // Chaise welting: baked into sofa utilization (welting=on is baseline)
  const chaiseWeltCredit = !rest.welting ? -(0.5 * Math.max(W + chaiseLength, 20) / 84) : 0;
  // Chaise skirt
  const chaiseSkirtConfig = { ...rest, W: W + chaiseLength, D } as COMConfig;
  const chaiseSkirtYards = calculateSkirtYardage(chaiseSkirtConfig, fabricWidth);
  const totalRaw = rawYards + chaiseWeltCredit + chaiseSkirtYards;

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
    bodyYards: Math.round(areaToYards(sumArea(bodyArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    armsYards: Math.round(areaToYards(sumArea(armArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
    cushionYards: Math.round(areaToYards(sumArea(cushArr), fabricWidth, utilization) * patternMultiplier * 100) / 100,
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
): COMResult {
  if (pieceType === 'sectional' && returnLength) {
    return calculateSectional({ ...config, returnLength });
  }
  if (pieceType === 'chaise_end' && chaiseLength) {
    return calculateChaise({ ...config, chaiseLength });
  }
  return calculateSinglePiece(config, pieceType);
}

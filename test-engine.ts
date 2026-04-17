// Quick test of the new COM engine against industry reference ranges
// Run with: npx tsx test-engine.ts

import { calculateCOM, type COMConfig } from './client/src/lib/comEngine';

function test(label: string, config: COMConfig, pieceType: string, expectedRange: [number, number], returnLength?: number, chaiseLength?: number) {
  const result = calculateCOM(config, pieceType, returnLength, chaiseLength);
  const inRange = result.total >= expectedRange[0] && result.total <= expectedRange[1];
  const status = inRange ? '✅' : '❌';
  console.log(`${status} ${label}: ${result.total} yds (expected ${expectedRange[0]}-${expectedRange[1]})`);
  console.log(`   Body: ${result.bodyYards} | Arms: ${result.armsYards} | Cushions: ${result.cushionYards}`);
  if (!inRange) {
    console.log(`   ⚠️  OFF by ${result.total < expectedRange[0] ? expectedRange[0] - result.total : result.total - expectedRange[1]} yds`);
  }
  console.log();
  return result;
}

// ─── Standard Sofa (84" wide, loose seat/loose back, 3 cushions) ────
// Industry range: 18-20 yards (Fabric Resource: sofa loose/loose no skirt)
test('Standard Sofa 84" (loose/loose, no skirt)', {
  W: 84, D: 36, H: 34, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'upholstered', skirt: false, arms: true, welting: true,
  nSeatCush: 3, nBackCush: 3, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
}, 'sofa', [16, 22]);

// ─── Standard Sofa (84", loose seat/tight back) ────────────────────
// Industry range: 16-18 yards
test('Standard Sofa 84" (loose/tight, no skirt)', {
  W: 84, D: 36, H: 34, seatHeight: 18,
  seatType: 'loose', backType: 'tight',
  base: 'upholstered', skirt: false, arms: true, welting: true,
  nSeatCush: 3, nBackCush: 0, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
}, 'sofa', [14, 20]);

// ─── Standard Sofa (84", tight/tight) ──────────────────────────────
// Industry range: 14-16 yards
test('Standard Sofa 84" (tight/tight, no skirt)', {
  W: 84, D: 36, H: 34, seatHeight: 18,
  seatType: 'tight', backType: 'tight',
  base: 'upholstered', skirt: false, arms: true, welting: true,
  nSeatCush: 0, nBackCush: 0, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
}, 'sofa', [12, 18]);

// ─── Sofa with skirt (loose/loose) ─────────────────────────────────
// Industry range: 20-22 yards
test('Standard Sofa 84" (loose/loose, WITH skirt)', {
  W: 84, D: 36, H: 34, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'upholstered', skirt: true, arms: true, welting: true,
  nSeatCush: 3, nBackCush: 3, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
}, 'sofa', [18, 24]);

// ─── Occasional Chair (loose/loose) ────────────────────────────────
// Industry range: 8-9 yards
test('Occasional Chair 32" (loose/loose)', {
  W: 32, D: 30, H: 32, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'wood_legs', skirt: false, arms: true, welting: true,
  nSeatCush: 1, nBackCush: 1, cushThick: 4,
  fabricWidth: 54, patternRepeat: 0,
}, 'chair', [6, 11]);

// ─── Dining Chair (fully upholstered, tight/tight) ─────────────────
// Industry range: 2-3 yards
test('Dining Chair 20" (tight/tight, no arms)', {
  W: 20, D: 20, H: 36, seatHeight: 18,
  seatType: 'tight', backType: 'tight',
  base: 'wood_legs', skirt: false, arms: false, welting: false,
  nSeatCush: 0, nBackCush: 0, cushThick: 0,
  fabricWidth: 54, patternRepeat: 0,
}, 'dining_chair', [2, 4]);

// ─── Ottoman ───────────────────────────────────────────────────────
// Industry range: 2-3 yards
test('Ottoman 24x24 (no skirt)', {
  W: 24, D: 24, H: 18, seatHeight: 18,
  seatType: 'tight', backType: 'tight',
  base: 'upholstered', skirt: false, arms: false, welting: false,
  nSeatCush: 0, nBackCush: 0, cushThick: 0,
  fabricWidth: 54, patternRepeat: 0,
}, 'ottoman', [1.5, 4]);

// ─── Berkeley Sofa 96" (from user's website) ───────────────────────
// Website says 21 yards. This is a big sofa, loose/loose, 3 cushions, wood legs
test('Berkeley Sofa 96" (loose/loose, wood legs)', {
  W: 96, D: 40, H: 34, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'wood_legs', skirt: false, arms: true, welting: true,
  nSeatCush: 3, nBackCush: 3, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
}, 'sofa', [18, 24]);

// ─── Berkeley Sectional (loose/loose) ──────────────────────────────
// Website says 44 yards. L-shape: main width 96", return length ~80", depth 40"
test('Berkeley Sectional 96" + 80" return (loose/loose)', {
  W: 96, D: 40, H: 34, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'wood_legs', skirt: false, arms: true, welting: true,
  nSeatCush: 3, nBackCush: 3, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
}, 'sectional', [35, 50], 80);

// ─── Berkeley Chaise End (loose/loose) ─────────────────────────────
// Website says 35 yards. Main width 96", chaise length ~70"
test('Berkeley Chaise End 96" + 70" chaise (loose/loose)', {
  W: 96, D: 40, H: 34, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'wood_legs', skirt: false, arms: true, welting: true,
  nSeatCush: 3, nBackCush: 3, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
}, 'chaise_end', [28, 42], undefined, 70);

// ─── Loveseat (55" wide) ───────────────────────────────────────────
test('Loveseat 55" (loose/loose)', {
  W: 55, D: 34, H: 34, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'upholstered', skirt: false, arms: true, welting: true,
  nSeatCush: 2, nBackCush: 2, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
}, 'loveseat', [11, 16]);

console.log('═══════════════════════════════════════════════');
console.log('Done. Check results above against industry ranges.');

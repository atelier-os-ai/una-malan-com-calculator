import { calculateCOM, type COMConfig } from './client/src/lib/comEngine';

// Debug: Occasional Chair
const chairConfig: COMConfig = {
  W: 32, D: 30, H: 32, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'wood_legs', skirt: false, arms: true, welting: true,
  nSeatCush: 1, nBackCush: 1, cushThick: 4,
  fabricWidth: 54, patternRepeat: 0,
};

const result = calculateCOM(chairConfig, 'chair');
console.log('=== Occasional Chair 32" ===');
console.log(`Total: ${result.total} yds`);
console.log(`\nPanel breakdown:`);
for (const p of result.panels) {
  console.log(`  ${p.name}: ${p.cutW}" × ${p.cutH}" × ${p.qty} (${p.category})`);
}
console.log(`\nTotal linear inches: ${result.totalLinearInches}`);

// Debug: Berkeley Sofa 96"
const sofaConfig: COMConfig = {
  W: 96, D: 40, H: 34, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'wood_legs', skirt: false, arms: true, welting: true,
  nSeatCush: 3, nBackCush: 3, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
};

const result2 = calculateCOM(sofaConfig, 'sofa');
console.log('\n=== Berkeley Sofa 96" ===');
console.log(`Total: ${result2.total} yds`);
console.log(`\nPanel breakdown:`);
for (const p of result2.panels) {
  console.log(`  ${p.name}: ${p.cutW}" × ${p.cutH}" × ${p.qty} (${p.category})`);
}
console.log(`\nTotal linear inches: ${result2.totalLinearInches}`);

// Debug: Standard Sofa 84" with skirt
const skirtConfig: COMConfig = {
  W: 84, D: 36, H: 34, seatHeight: 18,
  seatType: 'loose', backType: 'loose',
  base: 'upholstered', skirt: true, arms: true, welting: true,
  nSeatCush: 3, nBackCush: 3, cushThick: 5,
  fabricWidth: 54, patternRepeat: 0,
};

const result3 = calculateCOM(skirtConfig, 'sofa');
console.log('\n=== Sofa 84" with skirt ===');
console.log(`Total: ${result3.total} yds`);
console.log(`\nPanel breakdown:`);
for (const p of result3.panels) {
  console.log(`  ${p.name}: ${p.cutW}" × ${p.cutH}" × ${p.qty} (${p.category})`);
}
console.log(`\nTotal linear inches: ${result3.totalLinearInches}`);

# COM Calculator UI Restoration — Changes Summary

## Overview
Restored the comprehensive layout of the COM Calculator UI from the original version. The calculation engine (`client/src/lib/comEngine.ts`) was **not modified** — only frontend/UI files were updated.

---

## Files Modified

### 1. `client/src/pages/calculator.tsx` — Major Rewrite
**Added 8 piece types** (up from 4):
- Chair, Loveseat, Sofa, Daybed, Ottoman, Bench, Sectional, Chaise End
- Each type has an icon, label, and dimension hint
- Type changes auto-populate sensible default dimensions (e.g. Ottoman: 30×24×18", no arms, tight back)
- New types map to engine piece types: Loveseat → sofa, Daybed → sofa, Ottoman → sofa (arms=false, backType=tight), Bench → sofa

**Per-component breakdown in results panel:**
- Outside Back, Inside Back, Inside Arms (pair), Outside Arms (pair)
- Deck / Seat Platform, Front Rail
- Seat Cushions (×N), Back Cushions (×N)
- Skirt, Welting / Piping
- Each component shows yardage + progress bar
- Category summary (Body, Arms & Fixed, Cushions) shown below

**Visual toggle cards for Configuration step:**
- Seat Type: Loose Cushion / Tight Seat with SVG icons
- Back Type: Loose Cushion / Tight Back with SVG icons
- Base: Upholstered / Wood Legs with SVG icons
- Replaces dropdown selects with visual card selection

**SVG piece diagram:**
- Shows on Configuration step
- Reflects current state: arms, loose cushions, skirt

**Advanced / Component Mode:**
- Collapsible section below the form
- Shows individual component yardage in a read-only list
- Toggles open/close with chevron icon

**Mobile responsive design:**
- Gold gradient sticky bar at top showing total yardage + Save button
- Form stacks vertically on mobile
- Step indicators scroll horizontally
- Results panel moves below form on mobile
- All touch-friendly with proper sizing

**Step indicator improvements:**
- Completed steps show checkmark icon instead of step icon
- Smooth fade-in-up animation on step transitions

**Yardage animation:**
- Pulse animation on total yardage number when value changes

**Configuration badges:**
- Piece type badge uses gold accent styling
- Other badges have visible border for better distinction

### 2. `client/src/pages/library.tsx` — Enhanced
- **Card-based layout** with 3-column grid on desktop, responsive down to 1 column
- **Summary bar** at top showing total pieces count and total COM yardage
- **Color-coded type badges** — each piece type gets a unique color (amber for chair, rose for loveseat, blue for sofa, etc.)
- **Breakdown mini-bars** on each card showing body/arms/cushion proportions
- **Formatted dates** with short month format
- **Hover shadow effect** on cards
- Supports all 8 piece types with icons

### 3. `client/src/pages/settings.tsx` — Enhanced
- **Fabric width presets** — quick-select buttons for 48", 54", 60"
- **Default pattern repeat** setting added
- **Reset to Defaults** button
- **Unsaved changes indicator** badge
- **Info icon with help text** for waste factor
- **Info note** explaining settings persistence

### 4. `client/src/components/app-sidebar.tsx` — Enhanced
- Added subtle gold gradient divider below brand name
- Added version info in footer: "v2.0 — Calibrated from 29 reference pieces"

### 5. `client/src/App.tsx` — Minor Update
- Simplified header rendering (both mobile and desktop get header)

### 6. `client/src/index.css` — Enhanced
- Added `yardage-pulse` keyframe animation for yardage number updates
- Added `animate-fade-in-up` animation for step transitions
- Added `mobile-sticky-bar` class with gold gradient for mobile top bar
- All existing dark theme and gold accent styles preserved

---

## What Was NOT Modified
- `client/src/lib/comEngine.ts` — Engine untouched, all calculations preserved
- `shared/schema.ts` — Database schema unchanged
- `server/routes.ts` — API routes unchanged
- `server/storage.ts` — Storage layer unchanged
- `tailwind.config.ts` — Tailwind config unchanged
- All shadcn/ui components — unchanged

---

## Technical Notes
- New piece types (Ottoman, Bench, Loveseat, Daybed) map to existing engine functions via `getEnginePieceType()` with appropriate config overrides
- Per-component breakdown is computed client-side in `computeComponentBreakdown()` using the same constants and formulas as the engine (TUCK=6, SEAM=3, WRAP=3, WIDTH_FACTOR=2.975, etc.)
- No localStorage/sessionStorage used (sandboxed iframe constraint)
- Build output at `dist/public/` — production ready

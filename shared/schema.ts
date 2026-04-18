import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const pieces = sqliteTable("pieces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  type: text("type").notNull(), // chair, sofa, sectional, chaise_end
  width: real("width").notNull(),
  depth: real("depth").notNull(),
  height: real("height").notNull(),
  seatHeight: real("seat_height").notNull(),
  seatType: text("seat_type").notNull(), // loose, tight
  backType: text("back_type").notNull(), // loose, tight
  base: text("base").notNull(), // upholstered, wood_legs
  skirt: integer("skirt", { mode: "boolean" }).notNull(),
  arms: integer("arms", { mode: "boolean" }).notNull(),
  welting: integer("welting", { mode: "boolean" }).notNull().default(true),
  nSeatCush: integer("n_seat_cush").notNull().default(0),
  nBackCush: integer("n_back_cush").notNull().default(0),
  cushThick: real("cush_thick").notNull().default(5),
  fabricWidth: real("fabric_width").notNull().default(54),
  patternRepeat: real("pattern_repeat").notNull().default(0),
  returnLength: real("return_length"), // for sectional
  chaiseLength: real("chaise_length"), // for chaise end
  // Chaise/daybed-specific overrides (null = use rules defaults)
  armCount: integer("arm_count"),       // 0, 1, 2
  armLength: real("arm_length"),        // inches
  backStyle: text("back_style"),        // full, partial, none
  backLength: real("back_length"),      // inches (for partial)
  totalYards: real("total_yards").notNull(),
  bodyYards: real("body_yards").notNull().default(0),
  armsYards: real("arms_yards").notNull().default(0),
  cushionYards: real("cushion_yards").notNull().default(0),
  createdAt: text("created_at").notNull().default(""),
});

export const insertPieceSchema = createInsertSchema(pieces).omit({
  id: true,
});

export type InsertPiece = z.infer<typeof insertPieceSchema>;
export type Piece = typeof pieces.$inferSelect;

// ─── Piece Type Groups ───────────────────────────────────────────
// 12 groups, each with fully independent rule sets.

export const PIECE_TYPE_GROUPS = [
  { id: "sofa_loveseat",    label: "Sofa / Loveseat",       pieceTypes: ["sofa", "loveseat"] },
  { id: "sectional",        label: "Sectional",             pieceTypes: ["sectional"] },
  { id: "chaise",           label: "Chaise / Chaise End",   pieceTypes: ["chaise_end"] },
  { id: "daybed",           label: "Daybed",                pieceTypes: ["daybed"] },
  { id: "chair",            label: "Chair (Lounge)",        pieceTypes: ["chair"] },
  { id: "dining_chair",     label: "Dining Chair",          pieceTypes: ["dining_chair"] },
  { id: "ottoman",          label: "Ottoman",               pieceTypes: ["ottoman"] },
  { id: "bench",            label: "Bench / Storage Bench", pieceTypes: ["bench", "storage_bench"] },
  { id: "upholstered_bed",  label: "Upholstered Bed",       pieceTypes: ["upholstered_bed"] },
  { id: "headboard",        label: "Headboard",             pieceTypes: ["headboard"] },
  { id: "drawer_fronts",    label: "Drawer Fronts",         pieceTypes: ["drawer_fronts"] },
  { id: "outdoor_cushions", label: "Outdoor Cushions",      pieceTypes: ["outdoor_cushions"] },
] as const;

export type PieceTypeGroupId = typeof PIECE_TYPE_GROUPS[number]["id"];

/** Map a calculator piece type → its rule group id */
export function pieceTypeToGroupId(pieceType: string): PieceTypeGroupId {
  for (const g of PIECE_TYPE_GROUPS) {
    if ((g.pieceTypes as readonly string[]).includes(pieceType)) return g.id;
  }
  return "chair"; // fallback
}

// ─── Engine Rules ───────────────────────────────────────────────
// Each rule belongs to a piece_type_group + category.

export const engineRules = sqliteTable("engine_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull(),
  pieceTypeGroup: text("piece_type_group").notNull().default("_global"),
  value: real("value").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull(),
  unit: text("unit").notNull().default(""),
  min: real("min"),
  max: real("max"),
  step: real("step").notNull().default(0.01),
});

// Unique on (key, piece_type_group) — enforced in application logic

export const insertEngineRuleSchema = createInsertSchema(engineRules).omit({
  id: true,
});

export type InsertEngineRule = z.infer<typeof insertEngineRuleSchema>;
export type EngineRule = typeof engineRules.$inferSelect;

// ─── Rule Templates ──────────────────────────────────────────────
// These define which rules each group gets, with group-appropriate defaults.

interface RuleTemplate {
  key: string;
  label: string;
  description: string;
  category: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** Default values per group. Key = group id, value = default number.
   *  "_default" is the fallback if a group isn't listed. */
  defaults: Record<string, number>;
  /** Which groups this rule applies to. If omitted, applies to all. */
  groups?: PieceTypeGroupId[];
  /** Which groups to exclude. Applied after `groups`. */
  excludeGroups?: PieceTypeGroupId[];
}

const RULE_TEMPLATES: RuleTemplate[] = [
  // ─── Allowances ────────────────────────────────────────────────
  {
    key: "SEAM", label: "Seam Allowance",
    description: "Seam allowance per edge (industry standard is 1\")",
    category: "allowances", unit: "in", min: 0.5, max: 3, step: 0.25,
    defaults: { _default: 1 },
  },
  {
    key: "TUCK", label: "Tuck-In Depth",
    description: "Tuck-in allowance for panels tucked into crevices",
    category: "allowances", unit: "in", min: 3, max: 10, step: 0.5,
    defaults: { _default: 6 },
  },
  {
    key: "WRAP", label: "Wrap-Around",
    description: "Wrap-around allowance for panels over edges",
    category: "allowances", unit: "in", min: 1, max: 6, step: 0.5,
    defaults: { _default: 2 },
  },
  {
    key: "ARM_WIDTH", label: "Standard Arm Width",
    description: "Default arm panel width",
    category: "allowances", unit: "in", min: 2, max: 14, step: 0.5,
    defaults: {
      _default: 8,
      dining_chair: 3,
      ottoman: 0,
      headboard: 0,
      drawer_fronts: 0,
      outdoor_cushions: 0,
    },
    excludeGroups: ["ottoman", "headboard", "drawer_fronts", "outdoor_cushions"],
  },

  // ─── Skirt ─────────────────────────────────────────────────────
  {
    key: "SKIRT_DROP", label: "Skirt Drop Height",
    description: "Standard skirt drop from bottom of frame",
    category: "skirt", unit: "in", min: 4, max: 14, step: 0.5,
    defaults: { _default: 8 },
    excludeGroups: ["drawer_fronts", "outdoor_cushions", "headboard"],
  },
  {
    key: "SKIRT_HEM", label: "Skirt Hem Allowance",
    description: "Hem + turn-under allowance for skirt bottom",
    category: "skirt", unit: "in", min: 1, max: 6, step: 0.5,
    defaults: { _default: 2 },
    excludeGroups: ["drawer_fronts", "outdoor_cushions", "headboard"],
  },
  {
    key: "SKIRT_PLEAT_MULTIPLIER", label: "Pleat Multiplier",
    description: "Fabric multiplier for pleat style. Kick=1.5, Box=2.5, Gathered=3.0, Straight=1.1",
    category: "skirt", unit: "×", min: 1.0, max: 3.5, step: 0.1,
    defaults: { _default: 1.5 },
    excludeGroups: ["drawer_fronts", "outdoor_cushions", "headboard"],
  },

  // ─── Welting ───────────────────────────────────────────────────
  {
    key: "WELT_BIAS_YIELD_FT_PER_YD", label: "Bias-Cut Yield",
    description: "Linear feet of bias-cut welt per yard of 54\" fabric",
    category: "welting", unit: "ft/yd", min: 50, max: 100, step: 1,
    defaults: { _default: 78 },
    excludeGroups: ["drawer_fronts", "outdoor_cushions"],
  },
  {
    key: "WELT_MIN_YARDS", label: "Minimum Welting Yardage",
    description: "Practical minimum — can't efficiently cut from less",
    category: "welting", unit: "yds", min: 0.25, max: 1.5, step: 0.25,
    defaults: { _default: 0.5 },
    excludeGroups: ["drawer_fronts", "outdoor_cushions"],
  },

  // ─── Utilization ───────────────────────────────────────────────
  {
    key: "UTILIZATION", label: "Fabric Utilization",
    description: "How efficiently fabric is used — lower = more waste",
    category: "utilization", unit: "%", min: 0.35, max: 0.95, step: 0.01,
    defaults: {
      _default: 0.70,
      sofa_loveseat: 0.62,  // LL default — most common for high-end
      sectional: 0.62,
      chaise: 0.62,
      daybed: 0.62,
      chair: 0.78,
      dining_chair: 0.70,
      ottoman: 0.78,
      bench: 0.75,
      upholstered_bed: 0.65,
      headboard: 0.80,
      drawer_fronts: 0.85,
      outdoor_cushions: 0.75,
    },
  },
  // Sofa-family groups also get TT/LT/LL variants
  {
    key: "UTIL_TIGHT_TIGHT", label: "Utilization — Tight/Tight",
    description: "All body panels, no cushion cuts (most seaming waste)",
    category: "utilization", unit: "%", min: 0.35, max: 0.85, step: 0.01,
    defaults: { _default: 0.55 },
    groups: ["sofa_loveseat", "sectional", "chaise", "daybed"],
  },
  {
    key: "UTIL_LOOSE_TIGHT", label: "Utilization — Loose Seat / Tight Back",
    description: "Mix of body panels + narrower seat cushion panels",
    category: "utilization", unit: "%", min: 0.45, max: 0.90, step: 0.01,
    defaults: { _default: 0.74 },
    groups: ["sofa_loveseat", "sectional", "chaise", "daybed"],
  },
  {
    key: "UTIL_LOOSE_LOOSE", label: "Utilization — Loose Seat / Loose Back",
    description: "Mix of body + seat + back cushion panels",
    category: "utilization", unit: "%", min: 0.40, max: 0.85, step: 0.01,
    defaults: { _default: 0.62 },
    groups: ["sofa_loveseat", "sectional", "chaise", "daybed"],
  },

  // ─── Tight Construction ────────────────────────────────────────
  {
    key: "TIGHT_BACK_PROFILE_PCT", label: "Tight Back Profile",
    description: "% of depth added to inside back height for 3D profile wrap",
    category: "tight_construction", unit: "%", min: 0.05, max: 0.35, step: 0.01,
    defaults: { _default: 0.17 },
    excludeGroups: ["drawer_fronts", "outdoor_cushions", "headboard"],
  },
  {
    key: "TIGHT_SEAT_PROFILE_MUL", label: "Tight Seat Profile",
    description: "Multiplier × cushion thickness for deck wrap on tight seats",
    category: "tight_construction", unit: "×", min: 0.5, max: 2.5, step: 0.1,
    defaults: { _default: 1.0 },
    excludeGroups: ["drawer_fronts", "outdoor_cushions", "headboard"],
  },
  {
    key: "TIGHT_CROWN_WRAP", label: "Tight Crown Wrap",
    description: "Crown wrap for tight backs (thicker rail, vs 2\" standard)",
    category: "tight_construction", unit: "in", min: 2, max: 10, step: 0.5,
    defaults: { _default: 4 },
    excludeGroups: ["drawer_fronts", "outdoor_cushions", "headboard"],
  },

  // ─── Chaise / Daybed Defaults ──────────────────────────────────
  // These set per-group defaults that the calculator pre-fills.
  {
    key: "DEFAULT_ARM_COUNT", label: "Default Arm Count",
    description: "Number of arms (0 = armless, 1 = one arm, 2 = two arms)",
    category: "piece_defaults", unit: "", min: 0, max: 3, step: 1,
    defaults: { chaise: 1, daybed: 2 },
    groups: ["chaise", "daybed"],
  },
  {
    key: "DEFAULT_ARM_LENGTH", label: "Default Arm Length",
    description: "Standard arm panel length in inches",
    category: "piece_defaults", unit: "in", min: 6, max: 40, step: 1,
    defaults: { chaise: 24, daybed: 28 },
    groups: ["chaise", "daybed"],
  },
  {
    key: "DEFAULT_BACK_STYLE", label: "Default Back Style",
    description: "1 = Full back, 0.5 = Partial back, 0 = No back. Sets how much of the back panel is upholstered.",
    category: "piece_defaults", unit: "", min: 0, max: 1, step: 0.5,
    defaults: { chaise: 1, daybed: 0 },
    groups: ["chaise", "daybed"],
  },
  {
    key: "DEFAULT_BACK_LENGTH", label: "Default Back Length",
    description: "Length of back panel in inches (for partial backs, proportion of full width)",
    category: "piece_defaults", unit: "in", min: 0, max: 96, step: 1,
    defaults: { chaise: 0, daybed: 0 },
    groups: ["chaise", "daybed"],
  },
];

/** Generate the complete set of default rules for all 12 groups */
export function generateDefaultRules(): Omit<InsertEngineRule, "id">[] {
  const allRules: Omit<InsertEngineRule, "id">[] = [];

  for (const group of PIECE_TYPE_GROUPS) {
    for (const tmpl of RULE_TEMPLATES) {
      // Check inclusion
      if (tmpl.groups && !(tmpl.groups as readonly string[]).includes(group.id)) continue;
      if (tmpl.excludeGroups && (tmpl.excludeGroups as readonly string[]).includes(group.id)) continue;

      const value = tmpl.defaults[group.id] ?? tmpl.defaults._default ?? 0;
      allRules.push({
        key: tmpl.key,
        pieceTypeGroup: group.id,
        value,
        label: tmpl.label,
        description: tmpl.description,
        category: tmpl.category,
        unit: tmpl.unit,
        min: tmpl.min,
        max: tmpl.max,
        step: tmpl.step,
      });
    }
  }

  return allRules;
}

/** Get the default value for a specific rule key + group */
export function getDefaultValue(key: string, groupId: string): number | undefined {
  const tmpl = RULE_TEMPLATES.find(t => t.key === key);
  if (!tmpl) return undefined;
  return tmpl.defaults[groupId] ?? tmpl.defaults._default;
}

// Legacy compat — the old DEFAULT_RULES array (flat, no groups)
// Still used by the engine as fallback defaults
export const DEFAULT_RULES = generateDefaultRules();

// Also export for the Rules UI to look up originals
export { RULE_TEMPLATES };

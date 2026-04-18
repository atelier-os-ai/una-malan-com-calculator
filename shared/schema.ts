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

// ─── Engine Rules ───────────────────────────────────────────────
// Each rule is a named constant the upholsterer can adjust live.
// Rules are grouped into categories for the UI.

export const engineRules = sqliteTable("engine_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: real("value").notNull(),
  label: text("label").notNull(),
  description: text("description").notNull().default(""),
  category: text("category").notNull(),
  unit: text("unit").notNull().default(""),
  min: real("min"),
  max: real("max"),
  step: real("step").notNull().default(0.01),
});

export const insertEngineRuleSchema = createInsertSchema(engineRules).omit({
  id: true,
});

export type InsertEngineRule = z.infer<typeof insertEngineRuleSchema>;
export type EngineRule = typeof engineRules.$inferSelect;

// Default rule values — used to seed the database on first run
export const DEFAULT_RULES: Omit<InsertEngineRule, "id">[] = [
  // Allowances
  { key: "SEAM", value: 1, label: "Seam Allowance", description: "Seam allowance per edge (industry standard is 1\")", category: "allowances", unit: "in", min: 0.5, max: 2, step: 0.25 },
  { key: "TUCK", value: 6, label: "Tuck-In Depth", description: "Tuck-in allowance for panels tucked into crevices", category: "allowances", unit: "in", min: 3, max: 8, step: 0.5 },
  { key: "WRAP", value: 2, label: "Wrap-Around", description: "Wrap-around allowance for panels over edges", category: "allowances", unit: "in", min: 1, max: 4, step: 0.5 },
  { key: "ARM_WIDTH", value: 8, label: "Standard Arm Width", description: "Default arm panel width for sofas and lounge chairs", category: "allowances", unit: "in", min: 4, max: 12, step: 0.5 },

  // Skirt
  { key: "SKIRT_DROP", value: 8, label: "Skirt Drop Height", description: "Standard skirt drop from bottom of frame", category: "skirt", unit: "in", min: 4, max: 12, step: 0.5 },
  { key: "SKIRT_HEM", value: 2, label: "Skirt Hem Allowance", description: "Hem + turn-under allowance for skirt bottom", category: "skirt", unit: "in", min: 1, max: 4, step: 0.5 },
  { key: "SKIRT_PLEAT_MULTIPLIER", value: 1.5, label: "Pleat Multiplier", description: "Fabric multiplier for pleat style. Kick=1.5, Box=2.5, Gathered=3.0, Straight=1.1", category: "skirt", unit: "×", min: 1.0, max: 3.5, step: 0.1 },

  // Welting
  { key: "WELT_BIAS_YIELD_FT_PER_YD", value: 78, label: "Bias-Cut Yield", description: "Linear feet of bias-cut welt per yard of 54\" fabric", category: "welting", unit: "ft/yd", min: 50, max: 100, step: 1 },
  { key: "WELT_MIN_YARDS", value: 0.5, label: "Minimum Welting Yardage", description: "Practical minimum — can't efficiently cut from less", category: "welting", unit: "yds", min: 0.25, max: 1.0, step: 0.25 },

  // Utilization
  { key: "CHAIR_UTILIZATION", value: 0.78, label: "Chair Utilization", description: "Lounge chairs, ottomans — smaller panels nest well (22% waste)", category: "utilization", unit: "%", min: 0.50, max: 0.95, step: 0.01 },
  { key: "DINING_CHAIR_UTILIZATION", value: 0.70, label: "Dining Chair Utilization", description: "Small irregular panels on curved frames (30% waste)", category: "utilization", unit: "%", min: 0.50, max: 0.95, step: 0.01 },
  { key: "SOFA_UTIL_TT", value: 0.55, label: "Sofa — Tight/Tight", description: "All panels are wide body panels → most seaming waste (45%)", category: "utilization", unit: "%", min: 0.40, max: 0.80, step: 0.01 },
  { key: "SOFA_UTIL_LT", value: 0.74, label: "Sofa — Loose/Tight", description: "Mix of body panels + narrower seat cushion panels (26% waste)", category: "utilization", unit: "%", min: 0.50, max: 0.90, step: 0.01 },
  { key: "SOFA_UTIL_LL", value: 0.62, label: "Sofa — Loose/Loose", description: "Mix of body + seat + back cushion panels (38% waste)", category: "utilization", unit: "%", min: 0.40, max: 0.85, step: 0.01 },

  // Tight construction
  { key: "TIGHT_BACK_PROFILE_PCT", value: 0.17, label: "Tight Back Profile", description: "% of depth added to inside back height for 3D profile wrap", category: "tight_construction", unit: "%", min: 0.05, max: 0.30, step: 0.01 },
  { key: "TIGHT_SEAT_PROFILE_MUL", value: 1.0, label: "Tight Seat Profile", description: "Multiplier × cushion thickness for deck wrap on tight seats", category: "tight_construction", unit: "×", min: 0.5, max: 2.0, step: 0.1 },
  { key: "TIGHT_CROWN_WRAP", value: 4, label: "Tight Crown Wrap", description: "Crown wrap for tight backs (thicker rail, vs 2\" standard)", category: "tight_construction", unit: "in", min: 2, max: 8, step: 0.5 },
];

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

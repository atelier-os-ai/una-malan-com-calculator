import { type Piece, type InsertPiece, pieces, type EngineRule, engineRules, generateDefaultRules, PIECE_TYPE_GROUPS } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Ensure tables exist (auto-create on startup)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    width REAL NOT NULL,
    depth REAL NOT NULL,
    height REAL NOT NULL,
    seat_height REAL NOT NULL,
    seat_type TEXT NOT NULL,
    back_type TEXT NOT NULL,
    base TEXT NOT NULL,
    skirt INTEGER NOT NULL,
    arms INTEGER NOT NULL,
    welting INTEGER NOT NULL DEFAULT 1,
    n_seat_cush INTEGER NOT NULL DEFAULT 0,
    n_back_cush INTEGER NOT NULL DEFAULT 0,
    cush_thick REAL NOT NULL DEFAULT 5,
    fabric_width REAL NOT NULL DEFAULT 54,
    pattern_repeat REAL NOT NULL DEFAULT 0,
    return_length REAL,
    chaise_length REAL,
    arm_count INTEGER,
    arm_length REAL,
    back_style TEXT,
    back_length REAL,
    total_yards REAL NOT NULL,
    body_yards REAL NOT NULL DEFAULT 0,
    arms_yards REAL NOT NULL DEFAULT 0,
    cushion_yards REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS engine_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    piece_type_group TEXT NOT NULL DEFAULT '_global',
    value REAL NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    min REAL,
    max REAL,
    step REAL NOT NULL DEFAULT 0.01
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  getAllPieces(): Promise<Piece[]>;
  getPiece(id: number): Promise<Piece | undefined>;
  createPiece(piece: InsertPiece): Promise<Piece>;
  deletePiece(id: number): Promise<void>;
  getAllRules(): Promise<EngineRule[]>;
  getRulesByGroup(groupId: string): Promise<EngineRule[]>;
  updateRule(key: string, groupId: string, value: number): Promise<EngineRule | undefined>;
  resetGroupRules(groupId: string): Promise<EngineRule[]>;
  resetAllRules(): Promise<EngineRule[]>;
  seedRulesIfEmpty(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getAllPieces(): Promise<Piece[]> {
    return db.select().from(pieces).orderBy(desc(pieces.createdAt)).all();
  }

  async getPiece(id: number): Promise<Piece | undefined> {
    return db.select().from(pieces).where(eq(pieces.id, id)).get();
  }

  async createPiece(piece: InsertPiece): Promise<Piece> {
    return db.insert(pieces).values(piece).returning().get();
  }

  async deletePiece(id: number): Promise<void> {
    db.delete(pieces).where(eq(pieces.id, id)).run();
  }

  // ─── Rules ──────────────────────────────────────────────────────
  async getAllRules(): Promise<EngineRule[]> {
    return db.select().from(engineRules).all();
  }

  async getRulesByGroup(groupId: string): Promise<EngineRule[]> {
    return db.select().from(engineRules)
      .where(eq(engineRules.pieceTypeGroup, groupId))
      .all();
  }

  async updateRule(key: string, groupId: string, value: number): Promise<EngineRule | undefined> {
    return db.update(engineRules)
      .set({ value })
      .where(and(
        eq(engineRules.key, key),
        eq(engineRules.pieceTypeGroup, groupId)
      ))
      .returning()
      .get();
  }

  async resetGroupRules(groupId: string): Promise<EngineRule[]> {
    // Delete this group's rules
    db.delete(engineRules)
      .where(eq(engineRules.pieceTypeGroup, groupId))
      .run();
    // Re-seed from defaults
    const defaults = generateDefaultRules().filter(r => r.pieceTypeGroup === groupId);
    for (const rule of defaults) {
      db.insert(engineRules).values(rule).run();
    }
    return this.getRulesByGroup(groupId);
  }

  async resetAllRules(): Promise<EngineRule[]> {
    db.delete(engineRules).run();
    const defaults = generateDefaultRules();
    for (const rule of defaults) {
      db.insert(engineRules).values(rule).run();
    }
    return db.select().from(engineRules).all();
  }

  async seedRulesIfEmpty(): Promise<void> {
    const existing = db.select().from(engineRules).all();
    
    // Check if we need to migrate from old schema (no piece_type_group column)
    // or if we have the old flat rules without groups
    const hasGroups = existing.some(r => r.pieceTypeGroup && r.pieceTypeGroup !== "_global");
    
    if (existing.length === 0 || !hasGroups) {
      // Fresh seed or migration from old flat rules
      if (existing.length > 0) {
        // Drop old rules
        db.delete(engineRules).run();
      }
      const defaults = generateDefaultRules();
      for (const rule of defaults) {
        db.insert(engineRules).values(rule).run();
      }
    }
  }
}

export const storage = new DatabaseStorage();

import { type Piece, type InsertPiece, pieces, type EngineRule, engineRules, DEFAULT_RULES } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

export interface IStorage {
  getAllPieces(): Promise<Piece[]>;
  getPiece(id: number): Promise<Piece | undefined>;
  createPiece(piece: InsertPiece): Promise<Piece>;
  deletePiece(id: number): Promise<void>;
  getAllRules(): Promise<EngineRule[]>;
  updateRule(key: string, value: number): Promise<EngineRule | undefined>;
  resetRules(): Promise<EngineRule[]>;
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

  async updateRule(key: string, value: number): Promise<EngineRule | undefined> {
    return db.update(engineRules)
      .set({ value })
      .where(eq(engineRules.key, key))
      .returning()
      .get();
  }

  async resetRules(): Promise<EngineRule[]> {
    // Delete all existing rules
    db.delete(engineRules).run();
    // Re-seed with defaults
    for (const rule of DEFAULT_RULES) {
      db.insert(engineRules).values(rule).run();
    }
    return db.select().from(engineRules).all();
  }

  async seedRulesIfEmpty(): Promise<void> {
    const existing = db.select().from(engineRules).all();
    if (existing.length === 0) {
      for (const rule of DEFAULT_RULES) {
        db.insert(engineRules).values(rule).run();
      }
    }
  }
}

export const storage = new DatabaseStorage();

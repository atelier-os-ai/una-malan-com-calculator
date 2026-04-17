import { type Piece, type InsertPiece, pieces } from "@shared/schema";
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
}

export const storage = new DatabaseStorage();

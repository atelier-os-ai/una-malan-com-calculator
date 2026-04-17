import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPieceSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all saved pieces
  app.get("/api/pieces", async (_req, res) => {
    try {
      const allPieces = await storage.getAllPieces();
      res.json(allPieces);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pieces" });
    }
  });

  // Get a single piece
  app.get("/api/pieces/:id", async (req, res) => {
    try {
      const piece = await storage.getPiece(Number(req.params.id));
      if (!piece) {
        return res.status(404).json({ message: "Piece not found" });
      }
      res.json(piece);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch piece" });
    }
  });

  // Create a new piece
  app.post("/api/pieces", async (req, res) => {
    try {
      const parsed = insertPieceSchema.parse(req.body);
      const piece = await storage.createPiece(parsed);
      res.status(201).json(piece);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid piece data" });
    }
  });

  // Delete a piece
  app.delete("/api/pieces/:id", async (req, res) => {
    try {
      await storage.deletePiece(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete piece" });
    }
  });

  return httpServer;
}

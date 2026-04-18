import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPieceSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed rules on startup
  await storage.seedRulesIfEmpty();

  // ─── Pieces ──────────────────────────────────────────────────
  app.get("/api/pieces", async (_req, res) => {
    try {
      const allPieces = await storage.getAllPieces();
      res.json(allPieces);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch pieces" });
    }
  });

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

  app.post("/api/pieces", async (req, res) => {
    try {
      const parsed = insertPieceSchema.parse(req.body);
      const piece = await storage.createPiece(parsed);
      res.status(201).json(piece);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid piece data" });
    }
  });

  app.delete("/api/pieces/:id", async (req, res) => {
    try {
      await storage.deletePiece(Number(req.params.id));
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete piece" });
    }
  });

  // ─── Engine Rules ────────────────────────────────────────────
  app.get("/api/rules", async (_req, res) => {
    try {
      const rules = await storage.getAllRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rules" });
    }
  });

  app.patch("/api/rules/:key", async (req, res) => {
    try {
      const { value } = req.body;
      if (typeof value !== "number") {
        return res.status(400).json({ message: "Value must be a number" });
      }
      const updated = await storage.updateRule(req.params.key, value);
      if (!updated) {
        return res.status(404).json({ message: "Rule not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update rule" });
    }
  });

  app.post("/api/rules/reset", async (_req, res) => {
    try {
      const rules = await storage.resetRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to reset rules" });
    }
  });

  return httpServer;
}

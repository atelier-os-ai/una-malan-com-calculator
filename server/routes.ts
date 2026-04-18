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
  // Get all rules (for overview or migration)
  app.get("/api/rules", async (_req, res) => {
    try {
      const rules = await storage.getAllRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rules" });
    }
  });

  // Get rules for a specific piece type group
  app.get("/api/rules/group/:groupId", async (req, res) => {
    try {
      const rules = await storage.getRulesByGroup(req.params.groupId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch group rules" });
    }
  });

  // Update a rule within a specific group
  app.patch("/api/rules/group/:groupId/:key", async (req, res) => {
    try {
      const { value } = req.body;
      if (typeof value !== "number") {
        return res.status(400).json({ message: "Value must be a number" });
      }
      const updated = await storage.updateRule(req.params.key, req.params.groupId, value);
      if (!updated) {
        return res.status(404).json({ message: "Rule not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update rule" });
    }
  });

  // Legacy: update rule by key only (updates first match — compat)
  app.patch("/api/rules/:key", async (req, res) => {
    try {
      const { value, groupId } = req.body;
      if (typeof value !== "number") {
        return res.status(400).json({ message: "Value must be a number" });
      }
      const group = groupId || "sofa_loveseat";
      const updated = await storage.updateRule(req.params.key, group, value);
      if (!updated) {
        return res.status(404).json({ message: "Rule not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update rule" });
    }
  });

  // Reset a specific group to defaults
  app.post("/api/rules/reset/:groupId", async (req, res) => {
    try {
      const rules = await storage.resetGroupRules(req.params.groupId);
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to reset group rules" });
    }
  });

  // Reset all rules to defaults
  app.post("/api/rules/reset", async (_req, res) => {
    try {
      const rules = await storage.resetAllRules();
      res.json(rules);
    } catch (error) {
      res.status(500).json({ message: "Failed to reset rules" });
    }
  });

  return httpServer;
}

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage";
import { generateLicenseKey, verifyLicenseKey } from "./license-service";
import { 
  createLicenseRequestSchema, 
  validateLicenseRequestSchema, 
  updateLicenseStatusSchema,
  type LicensePayload 
} from "@shared/schema";
import { z } from "zod";
import pgSession from "connect-pg-simple";
import { pool } from "./db";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await storage.initializeDefaultAdmin();

  const PgSession = pgSession(session);
  
  app.set("trust proxy", 1);
  
  app.use(
    session({
      store: new PgSession({
        pool: pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET || "license-server-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
      },
    })
  );

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).send("Username and password are required");
      }

      const user = await storage.validateUserPassword(username, password);
      if (!user) {
        return res.status(401).send("Invalid credentials");
      }

      req.session.userId = user.id;
      res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).send("Internal server error");
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).send("Failed to logout");
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    res.json({ user: { id: user.id, username: user.username } });
  });

  app.post("/api/licenses", requireAuth, async (req, res) => {
    try {
      const validationResult = createLicenseRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { tenantId, modules, expiry, createdBy } = validationResult.data;

      const payload: LicensePayload = {
        tenantId,
        modules,
        expiry: new Date(expiry).toISOString(),
      };

      const licenseKey = generateLicenseKey(payload);

      const license = await storage.createLicense({
        tenantId,
        modules,
        expiry: new Date(expiry),
        licenseKey,
        status: "ACTIVE",
        createdBy,
      });

      await storage.createLicenseEvent({
        licenseId: license.id,
        eventType: "CREATED",
        message: `License created for tenant ${tenantId} with modules: ${modules.join(", ")}`,
        actor: createdBy,
      });

      res.status(201).json(license);
    } catch (error) {
      console.error("Create license error:", error);
      res.status(500).send("Failed to create license");
    }
  });

  app.get("/api/licenses", requireAuth, async (req, res) => {
    try {
      const licenses = await storage.getAllLicenses();
      res.json(licenses);
    } catch (error) {
      console.error("Get licenses error:", error);
      res.status(500).send("Failed to get licenses");
    }
  });

  app.get("/api/licenses/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const license = await storage.getLicenseById(id);
      
      if (!license) {
        return res.status(404).json({ error: "License not found" });
      }

      const events = await storage.getLicenseEvents(id);
      res.json({ license, events });
    } catch (error) {
      console.error("Get license error:", error);
      res.status(500).send("Failed to get license");
    }
  });

  app.post("/api/licenses/validate", async (req, res) => {
    try {
      const validationResult = validateLicenseRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          valid: false, 
          reason: "MALFORMED",
          details: validationResult.error.errors 
        });
      }

      const { licenseKey } = validationResult.data;

      const verifyResult = verifyLicenseKey(licenseKey);
      
      const dbLicense = await storage.getLicenseByKey(licenseKey);
      
      if (!dbLicense) {
        return res.json({
          valid: false,
          reason: "NOT_FOUND",
        });
      }

      if (dbLicense.status === "REVOKED") {
        await storage.createLicenseEvent({
          licenseId: dbLicense.id,
          eventType: "VALIDATED",
          message: "License validation failed: License is revoked",
          actor: "system",
        });

        return res.json({
          valid: false,
          reason: "REVOKED",
          payload: verifyResult.payload,
        });
      }

      if (dbLicense.status === "EXPIRED" || !verifyResult.valid && verifyResult.reason === "EXPIRED") {
        if (dbLicense.status !== "EXPIRED") {
          await storage.updateLicenseStatus(dbLicense.id, "EXPIRED");
        }

        await storage.createLicenseEvent({
          licenseId: dbLicense.id,
          eventType: "VALIDATED",
          message: "License validation failed: License has expired",
          actor: "system",
        });

        return res.json({
          valid: false,
          reason: "EXPIRED",
          payload: verifyResult.payload,
        });
      }

      if (!verifyResult.valid) {
        await storage.createLicenseEvent({
          licenseId: dbLicense.id,
          eventType: "VALIDATED",
          message: `License validation failed: ${verifyResult.reason}`,
          actor: "system",
        });

        return res.json(verifyResult);
      }

      await storage.createLicenseEvent({
        licenseId: dbLicense.id,
        eventType: "VALIDATED",
        message: "License validation successful",
        actor: "system",
      });

      res.json({
        valid: true,
        reason: "OK",
        payload: verifyResult.payload,
      });
    } catch (error) {
      console.error("Validate license error:", error);
      res.status(500).json({ valid: false, reason: "MALFORMED" });
    }
  });

  app.patch("/api/licenses/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const validationResult = updateLicenseStatusSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { status } = validationResult.data;

      const existingLicense = await storage.getLicenseById(id);
      if (!existingLicense) {
        return res.status(404).json({ error: "License not found" });
      }

      const oldStatus = existingLicense.status;
      const updatedLicense = await storage.updateLicenseStatus(id, status);

      if (updatedLicense) {
        const user = await storage.getUser(req.session.userId!);
        await storage.createLicenseEvent({
          licenseId: id,
          eventType: "STATUS_CHANGED",
          message: `License status changed from ${oldStatus} to ${status}`,
          actor: user?.username || "admin",
        });
      }

      res.json(updatedLicense);
    } catch (error) {
      console.error("Update license status error:", error);
      res.status(500).send("Failed to update license status");
    }
  });

  return httpServer;
}

import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { generateLicenseKey, verifyLicenseKey } from "./license-service";
import { 
  createLicenseRequestSchema, 
  validateLicenseRequestSchema, 
  updateLicenseStatusSchema,
  type LicensePayload 
} from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "license-server-jwt-secret";

interface JwtPayload {
  userId: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await storage.initializeDefaultAdmin();

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

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      res.json({ 
        token,
        user: { id: user.id, username: user.username } 
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).send("Internal server error");
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ success: true });
  });

  app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      const user = await storage.getUser(decoded.userId);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      res.json({ user: { id: user.id, username: user.username } });
    } catch (error) {
      return res.status(401).json({ error: "Invalid token" });
    }
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
        await storage.createLicenseEvent({
          licenseId: id,
          eventType: "STATUS_CHANGED",
          message: `License status changed from ${oldStatus} to ${status}`,
          actor: req.user?.username || "admin",
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

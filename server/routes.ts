import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import jwt from "jsonwebtoken";
import { storage } from "./storage";
import { generateLicenseKey, verifyLicenseKey } from "./license-service";
import { 
  createLicenseRequestSchema, 
  validateLicenseRequestSchema, 
  updateLicenseStatusSchema,
  extendLicenseSchema,
  createUserRequestSchema,
  updateUserRequestSchema,
  activateLicenseRequestSchema,
  type LicensePayload 
} from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "license-server-jwt-secret";

interface JwtPayload {
  userId: string;
  username: string;
  role?: string;
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

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = decoded;
    
    const user = await storage.getUser(decoded.userId);
    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required" });
    }
    
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
      const activations = await storage.getLicenseActivations(id);
      res.json({ license, events, activations });
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

  app.post("/api/licenses/activate", async (req, res) => {
    try {
      const validationResult = activateLicenseRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          activated: false, 
          reason: "MALFORMED",
          details: validationResult.error.errors 
        });
      }

      const { licenseKey, hardwareId } = validationResult.data;
      const publicIp = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";

      const verifyResult = verifyLicenseKey(licenseKey);
      
      const dbLicense = await storage.getLicenseByKey(licenseKey);
      
      if (!dbLicense) {
        return res.json({
          activated: false,
          reason: "NOT_FOUND",
        });
      }

      if (dbLicense.status === "REVOKED") {
        return res.json({
          activated: false,
          reason: "REVOKED",
        });
      }

      if (dbLicense.status === "EXPIRED" || (!verifyResult.valid && verifyResult.reason === "EXPIRED")) {
        return res.json({
          activated: false,
          reason: "EXPIRED",
        });
      }

      if (!verifyResult.valid) {
        return res.json({
          activated: false,
          reason: verifyResult.reason,
        });
      }

      const existingActivation = await storage.getActivationByHardwareId(dbLicense.id, hardwareId);
      if (existingActivation) {
        await storage.createLicenseEvent({
          licenseId: dbLicense.id,
          eventType: "VALIDATED",
          message: `License re-validated for existing hardware: ${hardwareId}`,
          actor: "system",
        });

        return res.json({
          activated: true,
          reason: "ALREADY_ACTIVATED",
          payload: verifyResult.payload,
        });
      }

      const currentActivations = await storage.getLicenseActivations(dbLicense.id);
      if (currentActivations.length >= dbLicense.maxActivations) {
        await storage.createLicenseEvent({
          licenseId: dbLicense.id,
          eventType: "VALIDATED",
          message: `Activation rejected: max activations (${dbLicense.maxActivations}) reached. Hardware: ${hardwareId}`,
          actor: "system",
        });

        return res.json({
          activated: false,
          reason: "MAX_ACTIVATIONS_REACHED",
          currentActivations: currentActivations.length,
          maxActivations: dbLicense.maxActivations,
        });
      }

      await storage.createLicenseActivation({
        licenseId: dbLicense.id,
        hardwareId,
        publicIp,
      });

      await storage.createLicenseEvent({
        licenseId: dbLicense.id,
        eventType: "VALIDATED",
        message: `License activated for new hardware: ${hardwareId} (IP: ${publicIp}). Activation ${currentActivations.length + 1}/${dbLicense.maxActivations}`,
        actor: "system",
      });

      res.json({
        activated: true,
        reason: "OK",
        payload: verifyResult.payload,
        activationNumber: currentActivations.length + 1,
        maxActivations: dbLicense.maxActivations,
      });
    } catch (error) {
      console.error("Activate license error:", error);
      res.status(500).json({ activated: false, reason: "INTERNAL_ERROR" });
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

  app.patch("/api/licenses/:id/extend", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      const validationResult = extendLicenseSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { newExpiry } = validationResult.data;
      const reactivate = req.body.reactivate !== false;

      const existingLicense = await storage.getLicenseById(id);
      if (!existingLicense) {
        return res.status(404).json({ error: "License not found" });
      }

      if (existingLicense.status === "REVOKED" && !reactivate) {
        return res.status(400).json({ 
          error: "Cannot extend revoked license without reactivation",
          isRevoked: true 
        });
      }

      const newExpiryDate = new Date(newExpiry);
      const payload: LicensePayload = {
        tenantId: existingLicense.tenantId,
        modules: existingLicense.modules,
        expiry: newExpiryDate.toISOString(),
      };

      const newLicenseKey = generateLicenseKey(payload);
      const updatedLicense = await storage.extendLicense(id, newExpiryDate, newLicenseKey, reactivate);

      if (updatedLicense) {
        const statusMessage = existingLicense.status === "REVOKED" && reactivate 
          ? ` License reactivated.` 
          : '';
        await storage.createLicenseEvent({
          licenseId: id,
          eventType: "STATUS_CHANGED",
          message: `License extended to ${newExpiryDate.toISOString().split('T')[0]}. New license key generated.${statusMessage}`,
          actor: req.user?.username || "admin",
        });
      }

      res.json(updatedLicense);
    } catch (error) {
      console.error("Extend license error:", error);
      res.status(500).send("Failed to extend license");
    }
  });

  app.get("/api/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(u => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).send("Failed to get users");
    }
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const validationResult = createUserRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const { username, password, role } = validationResult.data;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      const user = await storage.createUser({ username, password, role });
      res.status(201).json({ id: user.id, username: user.username, role: user.role, createdAt: user.createdAt });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).send("Failed to create user");
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      const validationResult = updateUserRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validationResult.error.errors 
        });
      }

      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (validationResult.data.username) {
        const userWithSameUsername = await storage.getUserByUsername(validationResult.data.username);
        if (userWithSameUsername && userWithSameUsername.id !== id) {
          return res.status(400).json({ error: "Username already exists" });
        }
      }

      const updatedUser = await storage.updateUser(id, validationResult.data);
      if (updatedUser) {
        res.json({ id: updatedUser.id, username: updatedUser.username, role: updatedUser.role, createdAt: updatedUser.createdAt });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).send("Failed to update user");
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ error: "User not found" });
      }

      if (existingUser.username === "admin") {
        return res.status(400).json({ error: "Cannot delete the default admin user" });
      }

      const deleted = await storage.deleteUser(id);
      if (deleted) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "User not found" });
      }
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).send("Failed to delete user");
    }
  });

  app.post("/api/settings/generate-secret", requireAdmin, async (req, res) => {
    try {
      const { length = 32 } = req.body;
      const clampedLength = Math.min(Math.max(Number(length) || 32, 16), 64);
      
      const crypto = await import("crypto");
      const secret = crypto.randomBytes(clampedLength).toString("base64");
      
      res.json({ secret });
    } catch (error) {
      console.error("Generate secret error:", error);
      res.status(500).send("Failed to generate secret");
    }
  });

  return httpServer;
}

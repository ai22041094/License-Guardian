import { 
  users, 
  licenses, 
  licenseEvents,
  licenseActivations,
  type User, 
  type InsertUser, 
  type License, 
  type InsertLicense,
  type LicenseEvent,
  type InsertLicenseEvent,
  type LicenseActivation,
  type InsertLicenseActivation,
  type UpdateUserRequest
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: UpdateUserRequest): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  validateUserPassword(username: string, password: string): Promise<User | null>;

  getAllLicenses(): Promise<License[]>;
  getLicenseById(id: string): Promise<License | undefined>;
  getLicenseByKey(licenseKey: string): Promise<License | undefined>;
  createLicense(license: Omit<License, "id" | "createdAt" | "updatedAt">): Promise<License>;
  updateLicenseStatus(id: string, status: "ACTIVE" | "REVOKED" | "EXPIRED"): Promise<License | undefined>;
  extendLicense(id: string, newExpiry: Date, newLicenseKey: string, reactivate?: boolean): Promise<License | undefined>;

  getLicenseEvents(licenseId: string): Promise<LicenseEvent[]>;
  createLicenseEvent(event: InsertLicenseEvent): Promise<LicenseEvent>;

  getLicenseActivations(licenseId: string): Promise<LicenseActivation[]>;
  getActivationByHardwareId(licenseId: string, hardwareId: string): Promise<LicenseActivation | undefined>;
  createLicenseActivation(activation: InsertLicenseActivation): Promise<LicenseActivation>;

  initializeDefaultAdmin(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<User | undefined> {
    const updateData: Partial<{ username: string; password: string; role: "ADMIN" | "USER" }> = {};
    
    if (data.username) {
      updateData.username = data.username;
    }
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    if (data.role) {
      updateData.role = data.role;
    }

    if (Object.keys(updateData).length === 0) {
      return this.getUser(id);
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async validateUserPassword(username: string, password: string): Promise<User | null> {
    const user = await this.getUserByUsername(username);
    if (!user) return null;
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;
    
    return user;
  }

  async getAllLicenses(): Promise<License[]> {
    return db.select().from(licenses).orderBy(desc(licenses.createdAt));
  }

  async getLicenseById(id: string): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.id, id));
    return license || undefined;
  }

  async getLicenseByKey(licenseKey: string): Promise<License | undefined> {
    const [license] = await db.select().from(licenses).where(eq(licenses.licenseKey, licenseKey));
    return license || undefined;
  }

  async createLicense(license: Omit<License, "id" | "createdAt" | "updatedAt">): Promise<License> {
    const [created] = await db
      .insert(licenses)
      .values({
        tenantId: license.tenantId,
        modules: license.modules,
        expiry: license.expiry,
        licenseKey: license.licenseKey,
        status: license.status,
        maxActivations: license.maxActivations,
        createdBy: license.createdBy,
      })
      .returning();
    return created;
  }

  async updateLicenseStatus(id: string, status: "ACTIVE" | "REVOKED" | "EXPIRED"): Promise<License | undefined> {
    const [updated] = await db
      .update(licenses)
      .set({ status, updatedAt: new Date() })
      .where(eq(licenses.id, id))
      .returning();
    return updated || undefined;
  }

  async extendLicense(id: string, newExpiry: Date, newLicenseKey: string, reactivate: boolean = true): Promise<License | undefined> {
    const license = await this.getLicenseById(id);
    if (!license) return undefined;

    const newStatus = license.status === "REVOKED" && !reactivate ? "REVOKED" : "ACTIVE";
    
    const [updated] = await db
      .update(licenses)
      .set({ 
        expiry: newExpiry, 
        licenseKey: newLicenseKey,
        status: newStatus,
        updatedAt: new Date() 
      })
      .where(eq(licenses.id, id))
      .returning();
    return updated || undefined;
  }

  async getLicenseEvents(licenseId: string): Promise<LicenseEvent[]> {
    return db
      .select()
      .from(licenseEvents)
      .where(eq(licenseEvents.licenseId, licenseId))
      .orderBy(desc(licenseEvents.createdAt));
  }

  async createLicenseEvent(event: InsertLicenseEvent): Promise<LicenseEvent> {
    const [created] = await db
      .insert(licenseEvents)
      .values(event)
      .returning();
    return created;
  }

  async getLicenseActivations(licenseId: string): Promise<LicenseActivation[]> {
    return db
      .select()
      .from(licenseActivations)
      .where(eq(licenseActivations.licenseId, licenseId))
      .orderBy(desc(licenseActivations.createdAt));
  }

  async getActivationByHardwareId(licenseId: string, hardwareId: string): Promise<LicenseActivation | undefined> {
    const [activation] = await db
      .select()
      .from(licenseActivations)
      .where(and(
        eq(licenseActivations.licenseId, licenseId),
        eq(licenseActivations.hardwareId, hardwareId)
      ));
    return activation || undefined;
  }

  async createLicenseActivation(activation: InsertLicenseActivation): Promise<LicenseActivation> {
    const [created] = await db
      .insert(licenseActivations)
      .values(activation)
      .returning();
    return created;
  }

  async initializeDefaultAdmin(): Promise<void> {
    const existingAdmin = await this.getUserByUsername("admin");
    if (!existingAdmin) {
      await this.createUser({
        username: "admin",
        password: "P@ssw0rd@123",
        role: "ADMIN",
      });
      console.log("Default admin user created: admin / P@ssw0rd@123");
    } else if (existingAdmin.role !== "ADMIN") {
      await this.updateUser(existingAdmin.id, { role: "ADMIN" });
      console.log("Default admin user role updated to ADMIN");
    }
  }
}

export const storage = new DatabaseStorage();

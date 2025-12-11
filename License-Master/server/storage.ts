import { 
  users, 
  licenses, 
  licenseEvents, 
  type User, 
  type InsertUser, 
  type License, 
  type InsertLicense,
  type LicenseEvent,
  type InsertLicenseEvent 
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  validateUserPassword(username: string, password: string): Promise<User | null>;

  getAllLicenses(): Promise<License[]>;
  getLicenseById(id: string): Promise<License | undefined>;
  getLicenseByKey(licenseKey: string): Promise<License | undefined>;
  createLicense(license: Omit<License, "id" | "createdAt" | "updatedAt">): Promise<License>;
  updateLicenseStatus(id: string, status: "ACTIVE" | "REVOKED" | "EXPIRED"): Promise<License | undefined>;

  getLicenseEvents(licenseId: string): Promise<LicenseEvent[]>;
  createLicenseEvent(event: InsertLicenseEvent): Promise<LicenseEvent>;

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

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
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

  async initializeDefaultAdmin(): Promise<void> {
    const existingAdmin = await this.getUserByUsername("admin");
    if (!existingAdmin) {
      await this.createUser({
        username: "admin",
        password: "P@ssw0rd@123",
      });
      console.log("Default admin user created: admin / P@ssw0rd@123");
    }
  }
}

export const storage = new DatabaseStorage();

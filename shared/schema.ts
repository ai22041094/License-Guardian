import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["ADMIN", "USER"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").notNull().default("USER"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  role: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const createUserRequestSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
});

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
});

export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const licenseStatusEnum = pgEnum("license_status", ["ACTIVE", "REVOKED", "EXPIRED"]);

export const licenses = pgTable("licenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull(),
  modules: text("modules").array().notNull(),
  expiry: timestamp("expiry").notNull(),
  licenseKey: text("license_key").notNull(),
  status: licenseStatusEnum("status").notNull().default("ACTIVE"),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const licensesRelations = relations(licenses, ({ many }) => ({
  events: many(licenseEvents),
}));

export const insertLicenseSchema = createInsertSchema(licenses).omit({
  id: true,
  licenseKey: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  expiry: z.string().or(z.date()),
});

export type InsertLicense = z.infer<typeof insertLicenseSchema>;
export type License = typeof licenses.$inferSelect;

export const licenseEventTypeEnum = pgEnum("license_event_type", ["CREATED", "STATUS_CHANGED", "VALIDATED"]);

export const licenseEvents = pgTable("license_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  licenseId: varchar("license_id").notNull().references(() => licenses.id, { onDelete: "cascade" }),
  eventType: licenseEventTypeEnum("event_type").notNull(),
  message: text("message").notNull(),
  actor: text("actor").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const licenseEventsRelations = relations(licenseEvents, ({ one }) => ({
  license: one(licenses, {
    fields: [licenseEvents.licenseId],
    references: [licenses.id],
  }),
}));

export const insertLicenseEventSchema = createInsertSchema(licenseEvents, {
  licenseId: (schema) => schema,
  eventType: (schema) => schema,
  message: (schema) => schema,
  actor: (schema) => schema,
}).pick({
  licenseId: true,
  eventType: true,
  message: true,
  actor: true,
});

export type InsertLicenseEvent = z.infer<typeof insertLicenseEventSchema>;
export type LicenseEvent = typeof licenseEvents.$inferSelect;

export const AVAILABLE_MODULES = ["CUSTOM_PORTAL", "ASSET_MANAGEMENT", "SERVICE_DESK", "EPM"] as const;
export type AvailableModule = typeof AVAILABLE_MODULES[number];

export interface LicensePayload {
  tenantId: string;
  modules: string[];
  expiry: string;
}

export const createLicenseRequestSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
  modules: z.array(z.enum(AVAILABLE_MODULES)).min(1, "At least one module is required"),
  expiry: z.string().min(1, "Expiry date is required"),
  createdBy: z.string().min(1, "Creator is required"),
});

export type CreateLicenseRequest = z.infer<typeof createLicenseRequestSchema>;

export const validateLicenseRequestSchema = z.object({
  licenseKey: z.string().min(1, "License key is required"),
});

export type ValidateLicenseRequest = z.infer<typeof validateLicenseRequestSchema>;

export const updateLicenseStatusSchema = z.object({
  status: z.enum(["ACTIVE", "REVOKED"]),
});

export type UpdateLicenseStatusRequest = z.infer<typeof updateLicenseStatusSchema>;

export const extendLicenseSchema = z.object({
  newExpiry: z.string().min(1, "New expiry date is required").refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, "Invalid date format").refine((date) => {
    const parsed = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parsed > today;
  }, "Expiry date must be in the future"),
});

export type ExtendLicenseRequest = z.infer<typeof extendLicenseSchema>;

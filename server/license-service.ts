import jwt from "jsonwebtoken";
import type { LicensePayload } from "@shared/schema";

const LICENSE_SIGNING_SECRET = process.env.LICENSE_SIGNING_SECRET || "default-license-signing-secret-change-in-production";

export function generateLicenseKey(payload: LicensePayload): string {
  return jwt.sign(payload, LICENSE_SIGNING_SECRET, {
    algorithm: "HS256",
  });
}

export interface VerifyResult {
  valid: boolean;
  reason: "OK" | "EXPIRED" | "INVALID_SIGNATURE" | "MALFORMED";
  payload?: LicensePayload;
}

export function verifyLicenseKey(token: string): VerifyResult {
  try {
    const decoded = jwt.verify(token, LICENSE_SIGNING_SECRET, {
      algorithms: ["HS256"],
    }) as LicensePayload;

    const expiryDate = new Date(decoded.expiry);
    if (expiryDate < new Date()) {
      return {
        valid: false,
        reason: "EXPIRED",
        payload: decoded,
      };
    }

    return {
      valid: true,
      reason: "OK",
      payload: decoded,
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      if (error.message.includes("invalid signature")) {
        return { valid: false, reason: "INVALID_SIGNATURE" };
      }
    }
    return { valid: false, reason: "MALFORMED" };
  }
}

// ============================================================================
// AUTHENTICATOR SERVICE - Business logic for TOTP Authenticator operations
// ============================================================================

import crypto from "crypto";
import { authenticatorRepository, type AuthenticatorFindOptions, type AuthenticatorPublic } from "../repositories";
import { getPrisma, type ServiceResult } from "../repositories/base.repository";
import type { AuthenticatorCreateInput, AuthenticatorUpdateInput, AuthenticatorWithCode } from "@magimanager/shared";

// TOTP code result
export interface TOTPCode {
  code: string;
  remainingSeconds: number;
  period: number;
}

class AuthenticatorService {
  /**
   * Generate TOTP code from base32 secret
   */
  private generateTOTP(
    secret: string,
    algorithm: string = "SHA1",
    digits: number = 6,
    period: number = 30
  ): TOTPCode {
    // Decode base32 secret
    const secretBuffer = this.base32Decode(secret.toUpperCase().replace(/\s/g, ""));

    // Get current time step
    const now = Math.floor(Date.now() / 1000);
    const timeStep = Math.floor(now / period);
    const remainingSeconds = period - (now % period);

    // Create time buffer (8 bytes, big-endian)
    const timeBuffer = Buffer.alloc(8);
    timeBuffer.writeBigInt64BE(BigInt(timeStep));

    // Map algorithm name to crypto algorithm
    const algoMap: Record<string, string> = {
      SHA1: "sha1",
      SHA256: "sha256",
      SHA512: "sha512",
    };
    const cryptoAlgo = algoMap[algorithm] || "sha1";

    // Generate HMAC
    const hmac = crypto.createHmac(cryptoAlgo, secretBuffer);
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    // Generate code
    const otp = binary % Math.pow(10, digits);
    const code = otp.toString().padStart(digits, "0");

    return { code, remainingSeconds, period };
  }

  /**
   * Decode base32 string to Buffer
   */
  private base32Decode(encoded: string): Buffer {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const cleanEncoded = encoded.replace(/=+$/, ""); // Remove padding

    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (const char of cleanEncoded) {
      const idx = alphabet.indexOf(char);
      if (idx === -1) {
        throw new Error(`Invalid base32 character: ${char}`);
      }

      value = (value << 5) | idx;
      bits += 5;

      if (bits >= 8) {
        bytes.push((value >> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }

    return Buffer.from(bytes);
  }

  /**
   * Validate base32 secret format
   */
  private isValidBase32(secret: string): boolean {
    const cleanSecret = secret.toUpperCase().replace(/\s/g, "").replace(/=+$/, "");
    const validChars = /^[A-Z2-7]+$/;
    return validChars.test(cleanSecret) && cleanSecret.length >= 16;
  }

  /**
   * Parse otpauth:// URI
   */
  parseOtpAuthUri(uri: string): {
    secret: string;
    issuer?: string;
    accountName?: string;
    algorithm?: string;
    digits?: number;
    period?: number;
  } | null {
    try {
      const url = new URL(uri);

      if (url.protocol !== "otpauth:") {
        return null;
      }

      if (url.host !== "totp") {
        return null; // Only support TOTP, not HOTP
      }

      const params = url.searchParams;
      const secret = params.get("secret");

      if (!secret) {
        return null;
      }

      // Parse label (format: "issuer:accountName" or just "accountName")
      const label = decodeURIComponent(url.pathname.slice(1)); // Remove leading /
      let issuer = params.get("issuer") || undefined;
      let accountName: string | undefined;

      if (label.includes(":")) {
        const [labelIssuer, ...rest] = label.split(":");
        if (!issuer) issuer = labelIssuer;
        accountName = rest.join(":");
      } else {
        accountName = label;
      }

      return {
        secret,
        issuer,
        accountName,
        algorithm: params.get("algorithm") || undefined,
        digits: params.get("digits") ? parseInt(params.get("digits")!, 10) : undefined,
        period: params.get("period") ? parseInt(params.get("period")!, 10) : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get authenticator by ID
   */
  async getById(id: string): Promise<ServiceResult<AuthenticatorPublic>> {
    try {
      const authenticator = await authenticatorRepository.findById(id);
      if (!authenticator) {
        return { success: false, error: "Authenticator not found" };
      }
      return { success: true, data: authenticator };
    } catch (error) {
      console.error("AuthenticatorService.getById error:", error);
      return { success: false, error: "Failed to fetch authenticator" };
    }
  }

  /**
   * Get all authenticators for an identity
   */
  async getByIdentityId(identityProfileId: string): Promise<ServiceResult<AuthenticatorPublic[]>> {
    try {
      const authenticators = await authenticatorRepository.findByIdentityId(identityProfileId);
      return { success: true, data: authenticators };
    } catch (error) {
      console.error("AuthenticatorService.getByIdentityId error:", error);
      return { success: false, error: "Failed to fetch authenticators" };
    }
  }

  /**
   * Get all authenticators (for standalone view)
   */
  async getAll(options: AuthenticatorFindOptions = {}): Promise<ServiceResult<AuthenticatorPublic[]>> {
    try {
      const authenticators = await authenticatorRepository.findAll(options);
      return { success: true, data: authenticators };
    } catch (error) {
      console.error("AuthenticatorService.getAll error:", error);
      return { success: false, error: "Failed to fetch authenticators" };
    }
  }

  /**
   * Get all authenticators with identity info (for standalone view)
   */
  async getAllWithIdentity(options: AuthenticatorFindOptions = {}): Promise<
    ServiceResult<(AuthenticatorPublic & { identityProfile: { id: string; fullName: string; email: string | null } | null })[]>
  > {
    try {
      const authenticators = await authenticatorRepository.findAllWithIdentity(options);
      return { success: true, data: authenticators };
    } catch (error) {
      console.error("AuthenticatorService.getAllWithIdentity error:", error);
      return { success: false, error: "Failed to fetch authenticators" };
    }
  }

  /**
   * Create a new authenticator
   */
  async create(
    data: AuthenticatorCreateInput,
    userId?: string | null
  ): Promise<ServiceResult<AuthenticatorPublic>> {
    try {
      // Validate secret format
      if (!this.isValidBase32(data.secret)) {
        return { success: false, error: "Invalid secret format. Must be a valid base32 string." };
      }

      // Validate identity exists if identityProfileId is provided
      if (data.identityProfileId) {
        const prisma = getPrisma();
        const identity = await prisma.identityProfile.findUnique({
          where: { id: data.identityProfileId },
        });

        if (!identity) {
          return { success: false, error: "Identity not found" };
        }
      }

      const authenticator = await authenticatorRepository.create(data);

      // Log activity if linked to an identity
      if (data.identityProfileId) {
        await this.logActivity(
          data.identityProfileId,
          "AUTHENTICATOR_ADDED",
          `Authenticator "${data.name}" added`,
          userId
        );
      }

      return { success: true, data: authenticator };
    } catch (error) {
      console.error("AuthenticatorService.create error:", error);
      return { success: false, error: "Failed to create authenticator" };
    }
  }

  /**
   * Update an authenticator
   */
  async update(
    id: string,
    data: AuthenticatorUpdateInput,
    userId?: string | null
  ): Promise<ServiceResult<AuthenticatorPublic>> {
    try {
      const existing = await authenticatorRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Authenticator not found" };
      }

      const authenticator = await authenticatorRepository.update(id, data);

      // Log activity if linked to an identity
      if (existing.identityProfileId) {
        await this.logActivity(
          existing.identityProfileId,
          "AUTHENTICATOR_UPDATED",
          `Authenticator "${authenticator.name}" updated`,
          userId
        );
      }

      return { success: true, data: authenticator };
    } catch (error) {
      console.error("AuthenticatorService.update error:", error);
      return { success: false, error: "Failed to update authenticator" };
    }
  }

  /**
   * Delete an authenticator
   */
  async delete(id: string, userId?: string | null): Promise<ServiceResult<void>> {
    try {
      const existing = await authenticatorRepository.findById(id);
      if (!existing) {
        return { success: false, error: "Authenticator not found" };
      }

      await authenticatorRepository.delete(id);

      // Log activity if linked to an identity
      if (existing.identityProfileId) {
        await this.logActivity(
          existing.identityProfileId,
          "AUTHENTICATOR_DELETED",
          `Authenticator "${existing.name}" deleted`,
          userId
        );
      }

      return { success: true };
    } catch (error) {
      console.error("AuthenticatorService.delete error:", error);
      return { success: false, error: "Failed to delete authenticator" };
    }
  }

  /**
   * Get current TOTP code for an authenticator
   */
  async getCode(id: string): Promise<ServiceResult<TOTPCode>> {
    try {
      const result = await authenticatorRepository.findByIdWithSecret(id);
      if (!result) {
        return { success: false, error: "Authenticator not found" };
      }

      const { authenticator, secret } = result;
      const code = this.generateTOTP(
        secret,
        authenticator.algorithm,
        authenticator.digits,
        authenticator.period
      );

      // Update last used timestamp (fire and forget)
      authenticatorRepository.updateLastUsed(id).catch(() => {});

      return { success: true, data: code };
    } catch (error) {
      console.error("AuthenticatorService.getCode error:", error);
      return { success: false, error: "Failed to generate code" };
    }
  }

  /**
   * Get authenticator with current code
   */
  async getWithCode(id: string): Promise<ServiceResult<AuthenticatorWithCode>> {
    try {
      const result = await authenticatorRepository.findByIdWithSecret(id);
      if (!result) {
        return { success: false, error: "Authenticator not found" };
      }

      const { authenticator, secret } = result;
      const { code, remainingSeconds } = this.generateTOTP(
        secret,
        authenticator.algorithm,
        authenticator.digits,
        authenticator.period
      );

      // Update last used timestamp (fire and forget)
      authenticatorRepository.updateLastUsed(id).catch(() => {});

      return {
        success: true,
        data: {
          ...authenticator,
          code,
          remainingSeconds,
        },
      };
    } catch (error) {
      console.error("AuthenticatorService.getWithCode error:", error);
      return { success: false, error: "Failed to get authenticator with code" };
    }
  }

  /**
   * Get all authenticators for an identity with current codes
   */
  async getByIdentityIdWithCodes(identityProfileId: string): Promise<ServiceResult<AuthenticatorWithCode[]>> {
    try {
      const authenticators = await authenticatorRepository.findByIdentityId(identityProfileId);

      const withCodes: AuthenticatorWithCode[] = [];

      for (const auth of authenticators) {
        const result = await authenticatorRepository.findByIdWithSecret(auth.id);
        if (result) {
          const { code, remainingSeconds } = this.generateTOTP(
            result.secret,
            auth.algorithm,
            auth.digits,
            auth.period
          );
          withCodes.push({
            ...auth,
            code,
            remainingSeconds,
          });
        }
      }

      return { success: true, data: withCodes };
    } catch (error) {
      console.error("AuthenticatorService.getByIdentityIdWithCodes error:", error);
      return { success: false, error: "Failed to fetch authenticators with codes" };
    }
  }

  /**
   * Log activity for an identity
   */
  private async logActivity(
    identityId: string,
    action: string,
    details: string,
    userId?: string | null
  ): Promise<void> {
    try {
      const prisma = getPrisma();
      await prisma.identityActivity.create({
        data: {
          identityProfileId: identityId,
          action,
          details,
          createdBy: userId || null,
        },
      });
    } catch (error) {
      console.error("Failed to log authenticator activity:", error);
    }
  }
}

export const authenticatorService = new AuthenticatorService();

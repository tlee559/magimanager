// Thin route wrapper for parsing otpauth:// URIs
import { parseOtpUriHandler } from "@magimanager/core/api-handlers";

export const POST = parseOtpUriHandler;

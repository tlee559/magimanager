// Thin route wrapper for getting current TOTP code
import { authenticatorCodeHandler } from "@magimanager/core/api-handlers";

export const GET = authenticatorCodeHandler;

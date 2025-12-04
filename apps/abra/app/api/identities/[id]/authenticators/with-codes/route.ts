// Thin route wrapper for authenticators with current TOTP codes
import { authenticatorsWithCodesHandler } from "@magimanager/core/api-handlers";

export const GET = authenticatorsWithCodesHandler;

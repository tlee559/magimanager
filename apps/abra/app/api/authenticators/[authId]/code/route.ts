// Thin route wrapper for getting current TOTP code for standalone authenticator
import { standaloneAuthenticatorCodeHandler } from "@magimanager/core/api-handlers";

export const GET = standaloneAuthenticatorCodeHandler;

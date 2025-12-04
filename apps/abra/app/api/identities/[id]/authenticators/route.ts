// Thin route wrapper for authenticators per identity
import { authenticatorsGetHandler, authenticatorPostHandler } from "@magimanager/core/api-handlers";

export const GET = authenticatorsGetHandler;
export const POST = authenticatorPostHandler;

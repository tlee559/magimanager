// Thin route wrapper for authenticators (standalone - not tied to identity)
import { authenticatorsGetAllHandler, authenticatorsPostHandler } from "@magimanager/core/api-handlers";

export const GET = authenticatorsGetAllHandler;
export const POST = authenticatorsPostHandler;

// Thin route wrapper using shared handlers from @magimanager/core
import { identityGetByIdHandler, identityPutHandler, identityPatchHandler, identityDeleteHandler } from "@magimanager/core/api-handlers";

export const GET = identityGetByIdHandler;
export const PUT = identityPutHandler;
export const PATCH = identityPatchHandler;
export const DELETE = identityDeleteHandler;

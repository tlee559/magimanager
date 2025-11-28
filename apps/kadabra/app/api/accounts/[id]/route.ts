// Thin route wrapper using shared handlers from @magimanager/core
import { accountGetByIdHandler, accountPatchHandler, accountDeleteHandler } from "@magimanager/core/api-handlers";

export const GET = accountGetByIdHandler;
export const PATCH = accountPatchHandler;
export const DELETE = accountDeleteHandler;

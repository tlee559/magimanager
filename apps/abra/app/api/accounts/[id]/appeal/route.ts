// Thin route wrapper using shared handlers from @magimanager/core
import { appealGetHandler, appealPostHandler, appealPatchHandler } from "@magimanager/core/api-handlers";

export const GET = appealGetHandler;
export const POST = appealPostHandler;
export const PATCH = appealPatchHandler;

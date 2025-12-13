// Thin route wrapper using shared handlers from @magimanager/core
import { decommissionRetryHandler } from "@magimanager/core/api-handlers";

export const POST = decommissionRetryHandler;

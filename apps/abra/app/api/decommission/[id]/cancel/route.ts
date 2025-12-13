// Thin route wrapper using shared handlers from @magimanager/core
import { decommissionCancelHandler } from "@magimanager/core/api-handlers";

export const POST = decommissionCancelHandler;

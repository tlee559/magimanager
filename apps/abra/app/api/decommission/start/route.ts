// Thin route wrapper using shared handlers from @magimanager/core
import { decommissionStartHandler } from "@magimanager/core/api-handlers";

export const POST = decommissionStartHandler;

// Thin route wrapper using shared handlers from @magimanager/core
import { changePasswordHandler } from "@magimanager/core/api-handlers";

export const POST = changePasswordHandler;

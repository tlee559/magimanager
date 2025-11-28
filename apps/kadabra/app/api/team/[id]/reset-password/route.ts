// Thin route wrapper using shared handlers from @magimanager/core
import { resetPasswordHandler } from "@magimanager/core/api-handlers";

export const POST = resetPasswordHandler;

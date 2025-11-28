// Thin route wrapper using shared handlers from @magimanager/core
import { needsAttentionHandler } from "@magimanager/core/api-handlers";

export const GET = needsAttentionHandler;

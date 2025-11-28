// Thin route wrapper using shared handlers from @magimanager/core
import { accountsGetHandler, accountsPostHandler } from "@magimanager/core/api-handlers";

export const GET = accountsGetHandler;
export const POST = accountsPostHandler;

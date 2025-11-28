// Thin route wrapper using shared handlers from @magimanager/core
import { identitiesGetHandler, identitiesPostHandler } from "@magimanager/core/api-handlers";

export const GET = identitiesGetHandler;
export const POST = identitiesPostHandler;

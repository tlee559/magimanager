// Thin route wrapper using shared handlers from @magimanager/core
import { teamGetHandler, teamPostHandler } from "@magimanager/core/api-handlers";

export const GET = teamGetHandler;
export const POST = teamPostHandler;

// Thin route wrapper using shared handlers from @magimanager/core
import { teamMemberGetHandler, teamMemberPatchHandler, teamMemberDeleteHandler } from "@magimanager/core/api-handlers";

export const GET = teamMemberGetHandler;
export const PATCH = teamMemberPatchHandler;
export const DELETE = teamMemberDeleteHandler;

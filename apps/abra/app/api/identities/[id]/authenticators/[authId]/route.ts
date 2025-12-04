// Thin route wrapper for single authenticator operations
import { authenticatorGetByIdHandler, authenticatorPutHandler, authenticatorDeleteHandler } from "@magimanager/core/api-handlers";

export const GET = authenticatorGetByIdHandler;
export const PUT = authenticatorPutHandler;
export const DELETE = authenticatorDeleteHandler;

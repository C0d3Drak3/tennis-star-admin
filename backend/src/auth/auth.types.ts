import type { IncomingMessage } from "node:http";

export interface AuthenticatedRequest extends IncomingMessage {
  authUser?: {
    id: string;
    email: string;
  };
}

import type { Role } from '@horizons/shared';

export interface AuthContext {
  userId: string;
  organizationId: string;
  role: Role;
  sessionId: string;
  name: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthTokenService, getCookieValue } from "./auth-token.service";
import type { AuthenticatedRequest } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authTokenService: AuthTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = getCookieValue(request, this.authTokenService.cookieName);
    const claims = token ? this.authTokenService.verify(token) : null;
    if (!claims) {
      throw new UnauthorizedException("Authentication required.");
    }

    request.authUser = { id: claims.sub, email: claims.email };
    return true;
  }
}

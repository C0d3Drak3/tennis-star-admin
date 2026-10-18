import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { ServerResponse } from "node:http";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthTokenService } from "./auth-token.service";
import type { AuthenticatedRequest } from "./auth.types";

interface LoginBody {
  email: string;
  password: string;
}

function validateLoginBody(body: unknown): LoginBody {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("A valid email and password are required.");
  }
  const candidate = body as Record<string, unknown>;
  if (
    typeof candidate.email !== "string" ||
    candidate.email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate.email) ||
    typeof candidate.password !== "string" ||
    candidate.password.length === 0 ||
    candidate.password.length > 1_024
  ) {
    throw new BadRequestException("A valid email and password are required.");
  }

  return { email: candidate.email.trim(), password: candidate.password };
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: ServerResponse,
  ) {
    const credentials = validateLoginBody(body);
    const { token, user } = await this.authService.login(
      credentials.email,
      credentials.password,
    );
    response.setHeader(
      "Set-Cookie",
      `${this.authTokenService.cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(this.authTokenService.cookieOptions.maxAge / 1_000)}${this.authTokenService.cookieOptions.secure ? "; Secure" : ""}`,
    );
    return user;
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) response: ServerResponse) {
    const { secure } = this.authTokenService.cookieOptions;
    response.setHeader(
      "Set-Cookie",
      `${this.authTokenService.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`,
    );
    return { success: true };
  }

  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: AuthenticatedRequest) {
    const user = request.authUser;
    if (!user) {
      throw new BadRequestException("Authenticated user context is missing.");
    }
    return this.authService.getSessionUser(user.id);
  }
}

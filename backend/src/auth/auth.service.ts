import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { verifyPassword } from "./password";
import { AuthTokenService } from "./auth-token.service";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authTokenService: AuthTokenService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    return {
      token: this.authTokenService.issue({ id: user.id, email: user.email }),
      user: { id: user.id, email: user.email },
    };
  }

  async getSessionUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });
    if (!user) {
      throw new UnauthorizedException("Authentication required.");
    }
    return user;
  }
}

import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthTokenService } from "./auth-token.service";

@Module({
  controllers: [AuthController],
  providers: [AuthGuard, AuthService, AuthTokenService],
})
export class AuthModule {}

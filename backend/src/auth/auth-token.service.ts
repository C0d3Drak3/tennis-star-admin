import type { IncomingMessage } from "node:http";
import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

interface TokenClaims {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

const COOKIE_NAME = "tennis_admin_session";
const JWT_HEADER = { alg: "HS256", typ: "JWT" };

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseDuration(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (!match) {
    throw new Error("JWT_EXPIRES_IN must use seconds, minutes, hours, or days (for example, 8h).");
  }

  const amount = Number(match[1]);
  const unitSeconds = { s: 1, m: 60, h: 3_600, d: 86_400 }[match[2] as "s" | "m" | "h" | "d"];
  const seconds = amount * unitSeconds;
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > 31_536_000) {
    throw new Error("JWT_EXPIRES_IN must be between 1 second and 365 days.");
  }
  return seconds;
}

function readConfig() {
  const secret = process.env.JWT_SECRET;
  if (
    !secret ||
    secret.startsWith("replace_with_") ||
    Buffer.byteLength(secret, "utf8") < 32
  ) {
    throw new Error("JWT_SECRET must be configured with at least 32 bytes.");
  }
  const expiresIn = process.env.JWT_EXPIRES_IN;
  if (!expiresIn) {
    throw new Error("JWT_EXPIRES_IN must be configured.");
  }

  return { secret, expiresInSeconds: parseDuration(expiresIn) };
}

function sign(input: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(input).digest();
}

function isTokenClaims(value: unknown): value is TokenClaims {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const claims = value as Record<string, unknown>;
  return (
    typeof claims.sub === "string" &&
    claims.sub.length > 0 &&
    typeof claims.email === "string" &&
    typeof claims.iat === "number" &&
    Number.isInteger(claims.iat) &&
    typeof claims.exp === "number" &&
    Number.isInteger(claims.exp)
  );
}

@Injectable()
export class AuthTokenService {
  readonly cookieName = COOKIE_NAME;

  get cookieOptions() {
    const { expiresInSeconds } = readConfig();
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: expiresInSeconds * 1_000,
    };
  }

  issue(user: { id: string; email: string }): string {
    const { secret, expiresInSeconds } = readConfig();
    const now = Math.floor(Date.now() / 1_000);
    const header = encodeJson(JWT_HEADER);
    const payload = encodeJson({
      sub: user.id,
      email: user.email,
      iat: now,
      exp: now + expiresInSeconds,
    } satisfies TokenClaims);
    const content = `${header}.${payload}`;
    return `${content}.${sign(content, secret).toString("base64url")}`;
  }

  verify(token: string): TokenClaims | null {
    const { secret } = readConfig();
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((part) => !/^[\w-]+$/.test(part))) {
      return null;
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    try {
      const header: unknown = JSON.parse(
        Buffer.from(encodedHeader, "base64url").toString("utf8"),
      );
      if (
        typeof header !== "object" ||
        header === null ||
        (header as Record<string, unknown>).alg !== "HS256" ||
        (header as Record<string, unknown>).typ !== "JWT"
      ) {
        return null;
      }

      const providedSignature = Buffer.from(encodedSignature, "base64url");
      const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret);
      if (
        providedSignature.length !== expectedSignature.length ||
        !timingSafeEqual(providedSignature, expectedSignature)
      ) {
        return null;
      }

      const payload: unknown = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      );
      if (!isTokenClaims(payload) || payload.exp <= Math.floor(Date.now() / 1_000)) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }
}

export function getCookieValue(
  request: Pick<IncomingMessage, "headers">,
  name: string,
): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex < 0 || cookie.slice(0, separatorIndex).trim() !== name) {
      continue;
    }
    try {
      return decodeURIComponent(cookie.slice(separatorIndex + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

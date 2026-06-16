import { SignJWT, jwtVerify } from "jose";
import { env } from "../config.js";

const encoder = new TextEncoder();
const secret = () => encoder.encode(env.JWT_SECRET);

export type AuthClaims = {
  sub: string;
  org_id: string;
  store_ids: string[];
  shop_domain?: string;
};

export async function signAccessToken(claims: AuthClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret());
}

export async function signRefreshToken(claims: AuthClaims): Promise<string> {
  return new SignJWT({ ...claims, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<AuthClaims & { type?: string }> {
  const { payload } = await jwtVerify(token, secret());
  return payload as AuthClaims & { type?: string };
}

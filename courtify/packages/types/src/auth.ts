import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type Login = z.infer<typeof LoginSchema>;

export const JwtPayloadSchema = z.object({
  sub: z.number().int(), // user id
  version: z.number().int(), // token_version for invalidation
  iat: z.number().optional(),
  exp: z.number().optional(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const UserProfileSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  full_name: z.string(),
  professional_title: z.string().nullable(),
  avatar_path: z.string().nullable(),
  totp_enabled: z.number(), // 0 | 1
  created_at: z.string(),
  updated_at: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

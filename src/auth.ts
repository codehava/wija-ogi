// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - NextAuth.js v5 Configuration
// Supports: Google OAuth + Email/Password (Credentials)
// ═══════════════════════════════════════════════════════════════════════════════

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Password hashing using Web Crypto API (no bcrypt needed)
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
    const passwordHash = await hashPassword(password);
    return passwordHash === hash;
}

const credentialsSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    action: z.enum(['login', 'register']).optional().default('login'),
    name: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: DrizzleAdapter(db as any),
    trustHost: true,
    session: {
        strategy: 'jwt',
    },
    pages: {
        // Login is handled on the home page (/)
    },
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
        Credentials({
            name: 'credentials',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
                action: { label: 'Action', type: 'text' },
                name: { label: 'Name', type: 'text' },
            },
            async authorize(credentials) {
                const parsed = credentialsSchema.safeParse(credentials);
                if (!parsed.success) return null;

                const { email, password, action, name } = parsed.data;

                if (action === 'register') {
                    // Check if user already exists
                    const existing = await db
                        .select()
                        .from(users)
                        .where(eq(users.email, email))
                        .limit(1);

                    if (existing.length > 0) {
                        throw new Error('Email sudah terdaftar');
                    }

                    const passwordHash = await hashPassword(password);
                    const [newUser] = await db
                        .insert(users)
                        .values({
                            email,
                            name: name || email.split('@')[0],
                            passwordHash,
                        })
                        .returning();

                    return {
                        id: newUser.id,
                        email: newUser.email,
                        name: newUser.name,
                        image: newUser.image,
                    };
                }

                // Login
                const [user] = await db
                    .select()
                    .from(users)
                    .where(eq(users.email, email))
                    .limit(1);

                if (!user || !user.passwordHash) return null;

                const isValid = await verifyPassword(password, user.passwordHash);
                if (!isValid) return null;

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (token?.id) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
});

import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

// Singleton — prevents "too many connections" on hot-reload in dev
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const { handlers, auth } = NextAuth({
  // NextAuth v5 reads AUTH_SECRET first, then NEXTAUTH_SECRET.
  // Pass it explicitly so the config error never fires.
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/auth", // always use our custom page, never NextAuth's default
  },
  callbacks: {
    async signIn({ user, profile }) {
      // Persist GitHub login to User.github so downstream services can rely on it.
      const login =
        profile && typeof (profile as any).login === "string"
          ? (profile as any).login
          : null;
      if (login && user?.id) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { github: login },
          });
        } catch {
          // best-effort — may fail if github login already matches
        }
      }
      return true;
    },
    async session({ session, user }) {
      // Expose user id + github handle to the client session.
      if (session.user) {
        (session.user as any).id = user.id;
        (session.user as any).github = (user as any).github ?? null;
      }
      return session;
    },
  },
});

export const GET = handlers.GET;
export const POST = handlers.POST;

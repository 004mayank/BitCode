import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const { handlers, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!
    })
  ],
  session: { strategy: "database" },
  pages: {
    signIn: "/auth",   // always use our custom page, never NextAuth's default
  },
  callbacks: {
    async jwt({ token, profile }) {
      // Capture GitHub login for downstream authorization.
      if (profile && typeof (profile as any).login === "string") {
        (token as any).github = (profile as any).login;
      }
      return token;
    },
    async signIn({ user, profile }) {
      // Persist GitHub login to User.github so downstream services can rely on it.
      const login = profile && typeof (profile as any).login === "string" ? (profile as any).login : null;
      if (login && user?.id) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { github: login }
          });
        } catch {
          // best-effort
        }
      }
      return true;
    },
    async session({ session, user }) {
      // Expose user id to the client.
      if (session.user) {
        (session.user as any).id = user.id;
      }
      return session;
    }
  }
});

export const GET = handlers.GET;
export const POST = handlers.POST;

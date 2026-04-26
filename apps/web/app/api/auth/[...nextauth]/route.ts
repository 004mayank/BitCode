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
  callbacks: {
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


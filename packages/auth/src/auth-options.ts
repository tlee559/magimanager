import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@magimanager/database";

async function getUserByEmail(email: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        role: true,
        status: true,
        firstLogin: true,
        unreadNotifications: true,
        mediaBuyer: {
          select: { id: true },
        },
      },
    });
    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
    return null;
  }
}

async function updateLastLogin(userId: string) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  } catch (error) {
    console.error("Error updating last login:", error);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const user = await getUserByEmail(credentials.email);

        if (!user) {
          throw new Error("Invalid credentials");
        }

        if (user.status === "INACTIVE") {
          throw new Error("Account is inactive");
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        // Update last login time
        await updateLastLogin(user.id);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          firstLogin: user.firstLogin,
          unreadNotifications: user.unreadNotifications,
          mediaBuyerId: user.mediaBuyer?.id || null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.firstLogin = (user as any).firstLogin;
        token.unreadNotifications = (user as any).unreadNotifications;
        token.mediaBuyerId = (user as any).mediaBuyerId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // Validate that user still exists in database
        const userExists = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { id: true },
        });

        if (!userExists) {
          throw new Error("Session expired. Please login again.");
        }

        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).firstLogin = token.firstLogin;
        (session.user as any).unreadNotifications = token.unreadNotifications;
        (session.user as any).mediaBuyerId = token.mediaBuyerId;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  // Cross-subdomain cookie configuration for SSO
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // Production: .magimanager.com (shared across abra/kadabra subdomains)
        // Development: localhost (shared across localhost:3000, localhost:3001)
        domain: process.env.NODE_ENV === "production" ? ".magimanager.com" : "localhost",
      },
    },
  },
};

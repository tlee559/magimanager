import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@magimanager/database";

// Detect if we're running on a production domain (not localhost)
function isProductionDomain(): boolean {
  // Check multiple signals to determine if we're in production
  if (process.env.NODE_ENV === "production") return true;
  if (process.env.VERCEL === "1") return true;

  // Check NEXTAUTH_URL for production domain
  const nextAuthUrl = process.env.NEXTAUTH_URL || "";
  if (nextAuthUrl.includes("magimanager.com")) return true;

  return false;
}

// Get the session token cookie name based on environment
function getSessionTokenName(): string {
  return isProductionDomain()
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

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
        token.role = user.role;
        token.firstLogin = user.firstLogin;
        token.unreadNotifications = user.unreadNotifications;
        token.mediaBuyerId = user.mediaBuyerId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        // Validate that user still exists in database
        const userExists = await prisma.user.findUnique({
          where: { id: token.id },
          select: { id: true },
        });

        if (!userExists) {
          throw new Error("Session expired. Please login again.");
        }

        session.user.id = token.id;
        session.user.role = token.role;
        session.user.firstLogin = token.firstLogin;
        session.user.unreadNotifications = token.unreadNotifications;
        session.user.mediaBuyerId = token.mediaBuyerId;
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
  // Cookie configuration for SSO across subdomains
  // Always set domain to .magimanager.com so session works on both apps
  cookies: {
    sessionToken: {
      name: getSessionTokenName(),
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProductionDomain(),
        // Share across all *.magimanager.com subdomains
        ...(isProductionDomain() ? { domain: ".magimanager.com" } : {}),
      },
    },
  },
};

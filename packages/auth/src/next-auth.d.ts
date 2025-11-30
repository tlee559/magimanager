import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "MEDIA_BUYER" | "ASSISTANT";
    firstLogin: boolean;
    unreadNotifications: number;
    mediaBuyerId: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "MEDIA_BUYER" | "ASSISTANT";
      firstLogin: boolean;
      unreadNotifications: number;
      mediaBuyerId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "MEDIA_BUYER" | "ASSISTANT";
    firstLogin: boolean;
    unreadNotifications: number;
    mediaBuyerId: string | null;
  }
}

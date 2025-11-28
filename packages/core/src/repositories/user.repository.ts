// ============================================================================
// USER REPOSITORY - Data access layer for User operations
// ============================================================================

import { getPrisma } from "./base.repository";
import type { User, UserCreateInput, UserUpdateInput, UserRole, UserStatus } from "@magimanager/shared";
import bcrypt from "bcryptjs";

export interface UserFindOptions {
  includeMediaBuyer?: boolean;
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UserWithRelations extends User {
  mediaBuyer?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

class UserRepository {
  private get prisma() {
    return getPrisma();
  }

  private buildInclude(options: UserFindOptions = {}) {
    return {
      mediaBuyer: options.includeMediaBuyer !== false,
    };
  }

  private buildWhere(options: UserFindOptions = {}) {
    const where: Record<string, unknown> = {};

    if (options.role) {
      where.role = options.role;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.search) {
      where.OR = [
        { name: { contains: options.search, mode: "insensitive" } },
        { email: { contains: options.search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  async findById(id: string): Promise<UserWithRelations | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { mediaBuyer: true },
    });

    if (user) {
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as UserWithRelations;
    }

    return null;
  }

  async findByEmail(email: string): Promise<(UserWithRelations & { password: string }) | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { mediaBuyer: true },
    });

    return user as (UserWithRelations & { password: string }) | null;
  }

  async findAll(options: UserFindOptions = {}): Promise<UserWithRelations[]> {
    const users = await this.prisma.user.findMany({
      where: this.buildWhere(options),
      include: this.buildInclude(options),
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
    });

    // Remove passwords from response
    return users.map((user) => {
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword as UserWithRelations;
    });
  }

  async count(options: UserFindOptions = {}): Promise<number> {
    return this.prisma.user.count({
      where: this.buildWhere(options),
    });
  }

  async create(data: UserCreateInput): Promise<UserWithRelations> {
    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        password: hashedPassword,
        role: data.role || "MEDIA_BUYER",
        status: "ACTIVE",
        firstLogin: true,
      },
      include: { mediaBuyer: true },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as UserWithRelations;
  }

  async update(id: string, data: UserUpdateInput): Promise<UserWithRelations> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.role !== undefined) updateData.role = data.role;
    if (data.status !== undefined) updateData.status = data.status;

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { mediaBuyer: true },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as UserWithRelations;
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        firstLogin: false,
      },
    });
  }

  async resetPassword(id: string): Promise<string> {
    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashedPassword,
        firstLogin: true,
      },
    });

    return tempPassword;
  }

  async delete(id: string): Promise<void> {
    // Delete related records first
    await this.prisma.notification.deleteMany({ where: { userId: id } });
    await this.prisma.threadMessage.deleteMany({ where: { authorId: id } });
    await this.prisma.accountRequest.deleteMany({ where: { requesterId: id } });

    // Finally delete the user
    await this.prisma.user.delete({ where: { id } });
  }

  async validatePassword(user: { password: string }, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async incrementUnreadNotifications(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { unreadNotifications: { increment: 1 } },
    });
  }

  async resetUnreadNotifications(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { unreadNotifications: 0 },
    });
  }
}

export const userRepository = new UserRepository();

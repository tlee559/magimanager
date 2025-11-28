// ============================================================================
// USER SERVICE - Business logic for User operations
// ============================================================================

import { userRepository, type UserFindOptions, type UserWithRelations } from "../repositories";
import type { ServiceResult } from "../repositories/base.repository";
import type { UserCreateInput, UserUpdateInput, UserRole } from "@magimanager/shared";

class UserService {
  async getById(id: string): Promise<ServiceResult<UserWithRelations>> {
    try {
      const user = await userRepository.findById(id);
      if (!user) {
        return { success: false, error: "User not found" };
      }
      return { success: true, data: user };
    } catch (error) {
      console.error("UserService.getById error:", error);
      return { success: false, error: "Failed to fetch user" };
    }
  }

  async getByEmail(email: string): Promise<ServiceResult<UserWithRelations>> {
    try {
      const user = await userRepository.findByEmail(email);
      if (!user) {
        return { success: false, error: "User not found" };
      }
      const { password: _, ...userWithoutPassword } = user;
      return { success: true, data: userWithoutPassword as UserWithRelations };
    } catch (error) {
      console.error("UserService.getByEmail error:", error);
      return { success: false, error: "Failed to fetch user" };
    }
  }

  async getAll(options: UserFindOptions = {}): Promise<ServiceResult<UserWithRelations[]>> {
    try {
      const users = await userRepository.findAll(options);
      return { success: true, data: users };
    } catch (error) {
      console.error("UserService.getAll error:", error);
      return { success: false, error: "Failed to fetch users" };
    }
  }

  async create(data: UserCreateInput): Promise<ServiceResult<UserWithRelations>> {
    try {
      // Validate required fields
      if (!data.email || !data.name || !data.password) {
        return { success: false, error: "Missing required fields: email, name, password" };
      }

      // Check for existing user
      const existing = await userRepository.findByEmail(data.email);
      if (existing) {
        return { success: false, error: "User with this email already exists" };
      }

      // Validate password strength
      if (data.password.length < 8) {
        return { success: false, error: "Password must be at least 8 characters" };
      }

      const user = await userRepository.create(data);
      return { success: true, data: user };
    } catch (error) {
      console.error("UserService.create error:", error);
      return { success: false, error: "Failed to create user" };
    }
  }

  async update(id: string, data: UserUpdateInput): Promise<ServiceResult<UserWithRelations>> {
    try {
      const existing = await userRepository.findById(id);
      if (!existing) {
        return { success: false, error: "User not found" };
      }

      // Check email uniqueness if changing
      if (data.email && data.email.toLowerCase() !== existing.email.toLowerCase()) {
        const existingByEmail = await userRepository.findByEmail(data.email);
        if (existingByEmail) {
          return { success: false, error: "User with this email already exists" };
        }
      }

      const user = await userRepository.update(id, data);
      return { success: true, data: user };
    } catch (error) {
      console.error("UserService.update error:", error);
      return { success: false, error: "Failed to update user" };
    }
  }

  async delete(id: string): Promise<ServiceResult<void>> {
    try {
      const existing = await userRepository.findById(id);
      if (!existing) {
        return { success: false, error: "User not found" };
      }

      await userRepository.delete(id);
      return { success: true };
    } catch (error) {
      console.error("UserService.delete error:", error);
      return { success: false, error: "Failed to delete user" };
    }
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string
  ): Promise<ServiceResult<void>> {
    try {
      const user = await userRepository.findByEmail(
        (await userRepository.findById(id))?.email || ""
      );
      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Validate current password
      const isValid = await userRepository.validatePassword(user, currentPassword);
      if (!isValid) {
        return { success: false, error: "Current password is incorrect" };
      }

      // Validate new password
      if (newPassword.length < 8) {
        return { success: false, error: "New password must be at least 8 characters" };
      }

      await userRepository.updatePassword(id, newPassword);
      return { success: true };
    } catch (error) {
      console.error("UserService.changePassword error:", error);
      return { success: false, error: "Failed to change password" };
    }
  }

  async resetPassword(id: string): Promise<ServiceResult<{ temporaryPassword: string }>> {
    try {
      const existing = await userRepository.findById(id);
      if (!existing) {
        return { success: false, error: "User not found" };
      }

      const temporaryPassword = await userRepository.resetPassword(id);
      return { success: true, data: { temporaryPassword } };
    } catch (error) {
      console.error("UserService.resetPassword error:", error);
      return { success: false, error: "Failed to reset password" };
    }
  }

  async authenticate(
    email: string,
    password: string
  ): Promise<ServiceResult<UserWithRelations>> {
    try {
      const user = await userRepository.findByEmail(email);
      if (!user) {
        return { success: false, error: "Invalid email or password" };
      }

      // Check if user is active
      if (user.status !== "ACTIVE") {
        return { success: false, error: "Account is inactive" };
      }

      // Validate password
      const isValid = await userRepository.validatePassword(user, password);
      if (!isValid) {
        return { success: false, error: "Invalid email or password" };
      }

      // Update last login
      await userRepository.updateLastLogin(user.id);

      const { password: _, ...userWithoutPassword } = user;
      return { success: true, data: userWithoutPassword as UserWithRelations };
    } catch (error) {
      console.error("UserService.authenticate error:", error);
      return { success: false, error: "Authentication failed" };
    }
  }

  async setRole(id: string, role: UserRole): Promise<ServiceResult<UserWithRelations>> {
    try {
      const existing = await userRepository.findById(id);
      if (!existing) {
        return { success: false, error: "User not found" };
      }

      const user = await userRepository.update(id, { role });
      return { success: true, data: user };
    } catch (error) {
      console.error("UserService.setRole error:", error);
      return { success: false, error: "Failed to update role" };
    }
  }

  async deactivate(id: string): Promise<ServiceResult<UserWithRelations>> {
    try {
      const existing = await userRepository.findById(id);
      if (!existing) {
        return { success: false, error: "User not found" };
      }

      const user = await userRepository.update(id, { status: "INACTIVE" });
      return { success: true, data: user };
    } catch (error) {
      console.error("UserService.deactivate error:", error);
      return { success: false, error: "Failed to deactivate user" };
    }
  }

  async activate(id: string): Promise<ServiceResult<UserWithRelations>> {
    try {
      const existing = await userRepository.findById(id);
      if (!existing) {
        return { success: false, error: "User not found" };
      }

      const user = await userRepository.update(id, { status: "ACTIVE" });
      return { success: true, data: user };
    } catch (error) {
      console.error("UserService.activate error:", error);
      return { success: false, error: "Failed to activate user" };
    }
  }
}

export const userService = new UserService();

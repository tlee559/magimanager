import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@magimanager/database";

// One-time use endpoint to reset admin password
// DELETE THIS FILE AFTER USE
export async function POST(request: Request) {
  try {
    const { secret } = await request.json();

    // Simple secret check to prevent abuse
    if (secret !== "reset-admin-2024") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = "admin@magimanager.com";
    const newPassword = "admin123";

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update the user
    const user = await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        status: "ACTIVE", // Ensure account is active
      },
    });

    return NextResponse.json({
      success: true,
      message: `Password reset for ${email}`,
      userId: user.id,
    });
  } catch (error) {
    console.error("Password reset error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}

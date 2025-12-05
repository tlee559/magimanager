import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/api-auth";
import { decrypt } from "@/lib/encryption";

/**
 * GET /api/settings/mcc - Get MCC connection status
 */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const settings = await prisma.appSettings.findFirst({
      select: {
        mccCustomerId: true,
        mccConnectionId: true,
        mccConnectedAt: true,
        mccConnectedByUserId: true,
      },
    });

    if (!settings?.mccConnectionId) {
      return NextResponse.json({
        connected: false,
        mccCustomerId: null,
        connectedEmail: null,
        connectedAt: null,
        connectedBy: null,
      });
    }

    // Get connection details
    const connection = await prisma.googleAdsConnection.findUnique({
      where: { id: settings.mccConnectionId },
      select: {
        googleEmail: true,
        status: true,
        tokenExpiresAt: true,
      },
    });

    // Get user who connected
    let connectedByUser = null;
    if (settings.mccConnectedByUserId) {
      connectedByUser = await prisma.user.findUnique({
        where: { id: settings.mccConnectedByUserId },
        select: { name: true, email: true },
      });
    }

    return NextResponse.json({
      connected: !!connection && connection.status === "active",
      mccCustomerId: settings.mccCustomerId,
      connectedEmail: connection?.googleEmail || null,
      connectedAt: settings.mccConnectedAt,
      connectedBy: connectedByUser,
      connectionStatus: connection?.status || null,
      tokenExpiresAt: connection?.tokenExpiresAt || null,
    });
  } catch (error) {
    console.error("Failed to fetch MCC status:", error);
    return NextResponse.json(
      { error: "Failed to fetch MCC status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/mcc - Disconnect MCC
 */
export async function DELETE() {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const settings = await prisma.appSettings.findFirst();
    if (!settings) {
      return NextResponse.json({ error: "Settings not found" }, { status: 404 });
    }

    const oldConnectionId = settings.mccConnectionId;

    // Clear MCC connection from settings
    await prisma.appSettings.update({
      where: { id: settings.id },
      data: {
        mccCustomerId: null,
        mccConnectionId: null,
        mccConnectedAt: null,
        mccConnectedByUserId: null,
      },
    });

    // Delete the connection if it exists and isn't used by any accounts
    if (oldConnectionId) {
      const accountsUsingConnection = await prisma.adAccount.count({
        where: { connectionId: oldConnectionId },
      });

      if (accountsUsingConnection === 0) {
        await prisma.googleAdsConnection.delete({
          where: { id: oldConnectionId },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect MCC:", error);
    return NextResponse.json(
      { error: "Failed to disconnect MCC" },
      { status: 500 }
    );
  }
}

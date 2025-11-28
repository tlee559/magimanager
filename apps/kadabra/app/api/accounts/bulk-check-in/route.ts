import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const bulkCheckInSchema = z.object({
  accountIds: z.array(z.string()).min(1, "At least one account ID is required"),
  dailySpend: z.number().min(0).optional(),
  // "keep" means don't change the current value
  accountHealth: z.enum(["keep", "active", "limited", "suspended", "banned"]).optional().default("keep"),
  billingStatus: z.enum(["keep", "not_started", "verified", "pending", "failed"]).optional().default("keep"),
  notes: z.string().optional(),
  checkedBy: z.string().optional().nullable(),
});

// POST /api/accounts/bulk-check-in - Perform bulk check-in for multiple accounts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = bulkCheckInSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { accountIds, dailySpend, accountHealth, billingStatus, notes, checkedBy } = result.data;

    // Fetch all accounts
    const accounts = await prisma.adAccount.findMany({
      where: {
        id: { in: accountIds },
      },
      select: {
        id: true,
        accountHealth: true,
        billingStatus: true,
        certStatus: true,
        currentSpendTotal: true,
        adsCount: true,
        campaignsCount: true,
      },
    });

    if (accounts.length === 0) {
      return NextResponse.json(
        { error: "No valid accounts found" },
        { status: 404 }
      );
    }

    const checkInsCreated: string[] = [];
    const accountsUpdated: string[] = [];
    const errors: { accountId: string; error: string }[] = [];

    // Process each account
    for (const account of accounts) {
      try {
        // Determine values to use
        const newHealth = accountHealth === "keep" ? account.accountHealth : accountHealth;
        const newBilling = billingStatus === "keep" ? account.billingStatus : billingStatus;

        // Calculate new total spend if dailySpend provided
        const newTotalSpend = dailySpend !== undefined
          ? account.currentSpendTotal + Math.round(dailySpend * 100) // dailySpend in dollars, store in cents
          : account.currentSpendTotal;

        // Create check-in record
        await prisma.accountCheckIn.create({
          data: {
            adAccountId: account.id,
            dailySpend: dailySpend ?? 0,
            totalSpend: newTotalSpend / 100, // Store as dollars in check-in
            adsCount: account.adsCount,
            campaignsCount: account.campaignsCount,
            accountHealth: newHealth,
            billingStatus: newBilling,
            certStatus: account.certStatus,
            notes: notes || null,
          },
        });

        checkInsCreated.push(account.id);

        // Update account if values changed
        const updateData: Record<string, unknown> = {};

        if (accountHealth !== "keep") {
          updateData.accountHealth = accountHealth;
        }
        if (billingStatus !== "keep") {
          updateData.billingStatus = billingStatus;
        }
        if (dailySpend !== undefined) {
          updateData.currentSpendTotal = newTotalSpend;
        }

        if (Object.keys(updateData).length > 0) {
          await prisma.adAccount.update({
            where: { id: account.id },
            data: updateData,
          });
          accountsUpdated.push(account.id);
        }

        // Log activity if status changed
        if (accountHealth !== "keep") {
          await prisma.accountActivity.create({
            data: {
              adAccountId: account.id,
              action: "STATUS_CHANGED",
              details: `Health changed to ${accountHealth} via bulk check-in`,
              createdBy: checkedBy || null,
            },
          });
        }
      } catch (err) {
        console.error(`Error processing account ${account.id}:`, err);
        errors.push({
          accountId: account.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        requested: accountIds.length,
        found: accounts.length,
        checkInsCreated: checkInsCreated.length,
        accountsUpdated: accountsUpdated.length,
        errors: errors.length,
      },
      checkInsCreated,
      accountsUpdated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("POST /api/accounts/bulk-check-in error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk check-in" },
      { status: 500 }
    );
  }
}

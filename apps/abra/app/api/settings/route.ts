import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireSuperAdmin } from "@/lib/api-auth";

// GET /api/settings - Get app settings
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    // Get or create settings
    let settings = await prisma.appSettings.findFirst();

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          warmupTargetSpend: 50,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/settings - Update app settings (Super Admin only for API keys)
export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const {
      warmupTargetSpend,
      gologinApiKey,
      googleAdsApiKey,
      googleApiKey,
      textverifiedApiKey,
      telegramBotToken,
      telegramChatId,
      // Website Wizard API keys
      namecheapApiKey,
      namecheapUsername,
      namecheapWhitelistIp,
      namecheapProxyUrl,
      digitaloceanApiKey,
      // Decommission alert settings
      decommissionAlertOnAccountDeath,
      decommissionAlertOnIdentityArchive,
      decommissionAlertViaApp,
      decommissionAlertViaTelegram,
      decommissionAlertCustomMessage,
      // Incomplete identity alert settings
      incompleteIdentityAlertEnabled,
      incompleteIdentityAlertViaApp,
      incompleteIdentityAlertViaTelegram,
      incompleteIdentityAlertOnCreate,
      incompleteIdentityAlertDaily,
      // Identity progress alert settings
      identityProgressAlertEnabled,
      identityProgressAlertViaApp,
      identityProgressAlertViaTelegram,
      identityProgressAlertOnDocAdded,
      identityProgressAlertOnWebsiteAdded,
      identityProgressAlertOnGologinCreated,
      identityProgressAlertOnAccountLinked,
    } = body;

    if (warmupTargetSpend !== undefined && warmupTargetSpend < 1) {
      return NextResponse.json(
        { error: "Warmup target spend must be at least $1" },
        { status: 400 }
      );
    }

    // Get or create settings
    let settings = await prisma.appSettings.findFirst();

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          warmupTargetSpend: warmupTargetSpend || 50,
          gologinApiKey: gologinApiKey || null,
          googleAdsApiKey: googleAdsApiKey || null,
          googleApiKey: googleApiKey || null,
          textverifiedApiKey: textverifiedApiKey || null,
          telegramBotToken: telegramBotToken || null,
          telegramChatId: telegramChatId || null,
        },
      });
    } else {
      settings = await prisma.appSettings.update({
        where: { id: settings.id },
        data: {
          ...(warmupTargetSpend !== undefined && { warmupTargetSpend }),
          ...(gologinApiKey !== undefined && { gologinApiKey: gologinApiKey || null }),
          ...(googleAdsApiKey !== undefined && { googleAdsApiKey: googleAdsApiKey || null }),
          ...(googleApiKey !== undefined && { googleApiKey: googleApiKey || null }),
          ...(textverifiedApiKey !== undefined && { textverifiedApiKey: textverifiedApiKey || null }),
          ...(telegramBotToken !== undefined && { telegramBotToken: telegramBotToken || null }),
          ...(telegramChatId !== undefined && { telegramChatId: telegramChatId || null }),
          // Website Wizard API keys
          ...(namecheapApiKey !== undefined && { namecheapApiKey: namecheapApiKey || null }),
          ...(namecheapUsername !== undefined && { namecheapUsername: namecheapUsername || null }),
          ...(namecheapWhitelistIp !== undefined && { namecheapWhitelistIp: namecheapWhitelistIp || null }),
          ...(namecheapProxyUrl !== undefined && { namecheapProxyUrl: namecheapProxyUrl || null }),
          ...(digitaloceanApiKey !== undefined && { digitaloceanApiKey: digitaloceanApiKey || null }),
          // Decommission alert settings
          ...(decommissionAlertOnAccountDeath !== undefined && { decommissionAlertOnAccountDeath }),
          ...(decommissionAlertOnIdentityArchive !== undefined && { decommissionAlertOnIdentityArchive }),
          ...(decommissionAlertViaApp !== undefined && { decommissionAlertViaApp }),
          ...(decommissionAlertViaTelegram !== undefined && { decommissionAlertViaTelegram }),
          ...(decommissionAlertCustomMessage !== undefined && { decommissionAlertCustomMessage: decommissionAlertCustomMessage || null }),
          // Incomplete identity alert settings
          ...(incompleteIdentityAlertEnabled !== undefined && { incompleteIdentityAlertEnabled }),
          ...(incompleteIdentityAlertViaApp !== undefined && { incompleteIdentityAlertViaApp }),
          ...(incompleteIdentityAlertViaTelegram !== undefined && { incompleteIdentityAlertViaTelegram }),
          ...(incompleteIdentityAlertOnCreate !== undefined && { incompleteIdentityAlertOnCreate }),
          ...(incompleteIdentityAlertDaily !== undefined && { incompleteIdentityAlertDaily }),
          // Identity progress alert settings
          ...(identityProgressAlertEnabled !== undefined && { identityProgressAlertEnabled }),
          ...(identityProgressAlertViaApp !== undefined && { identityProgressAlertViaApp }),
          ...(identityProgressAlertViaTelegram !== undefined && { identityProgressAlertViaTelegram }),
          ...(identityProgressAlertOnDocAdded !== undefined && { identityProgressAlertOnDocAdded }),
          ...(identityProgressAlertOnWebsiteAdded !== undefined && { identityProgressAlertOnWebsiteAdded }),
          ...(identityProgressAlertOnGologinCreated !== undefined && { identityProgressAlertOnGologinCreated }),
          ...(identityProgressAlertOnAccountLinked !== undefined && { identityProgressAlertOnAccountLinked }),
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

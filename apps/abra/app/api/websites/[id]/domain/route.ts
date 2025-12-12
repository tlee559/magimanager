import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  getNamecheapClientFromSettings,
  type DomainAvailability,
} from "@magimanager/core";

// POST /api/websites/[id]/domain - Search or purchase domain
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { action, keyword, domain, tlds } = body;

    // Check website exists
    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    // Get Namecheap client
    let client;
    try {
      client = await getNamecheapClientFromSettings();
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Namecheap not configured" },
        { status: 400 }
      );
    }

    // Handle different actions
    if (action === "search") {
      // Search for available domains
      if (!keyword || typeof keyword !== "string") {
        return NextResponse.json(
          { error: "Keyword is required for domain search" },
          { status: 400 }
        );
      }

      const cleanKeyword = keyword.toLowerCase().trim();
      const searchTlds = tlds || ["com", "net", "org", "io", "co"];

      // Check if user entered a full domain (contains a dot)
      // If so, extract just the domain name part and also check the exact domain
      let results: DomainAvailability[];
      if (cleanKeyword.includes(".")) {
        // User entered something like "example.com"
        // Extract the base name (everything before first dot)
        const baseName = cleanKeyword.split(".")[0];
        // Check both the exact domain entered AND variations with other TLDs
        const exactResult = await client.checkDomain(cleanKeyword);
        const otherResults = await client.searchDomains(baseName, searchTlds.filter((tld: string) => !cleanKeyword.endsWith(`.${tld}`)));
        // Put the exact domain first, then other TLD options
        results = [exactResult, ...otherResults];
      } else {
        // User entered just a keyword like "example"
        results = await client.searchDomains(cleanKeyword, searchTlds);
      }

      return NextResponse.json({
        results,
        keyword: cleanKeyword,
      });
    }

    if (action === "check") {
      // Check single domain availability
      if (!domain || typeof domain !== "string") {
        return NextResponse.json(
          { error: "Domain is required" },
          { status: 400 }
        );
      }

      const result = await client.checkDomain(domain.toLowerCase().trim());
      return NextResponse.json({ result });
    }

    if (action === "purchase") {
      // Purchase domain
      if (!domain || typeof domain !== "string") {
        return NextResponse.json(
          { error: "Domain is required for purchase" },
          { status: 400 }
        );
      }

      // Update status
      await prisma.website.update({
        where: { id },
        data: {
          status: "DOMAIN_PENDING",
          statusMessage: `Purchasing ${domain}...`,
        },
      });

      // First check availability
      const availability = await client.checkDomain(domain.toLowerCase().trim());
      if (!availability.available) {
        await prisma.website.update({
          where: { id },
          data: {
            status: "PENDING",
            statusMessage: "Domain not available",
          },
        });
        return NextResponse.json(
          { error: "Domain is not available" },
          { status: 400 }
        );
      }

      // Purchase the domain
      const result = await client.purchaseDomain(domain.toLowerCase().trim());

      if (!result.success) {
        await prisma.website.update({
          where: { id },
          data: {
            status: "FAILED",
            errorMessage: result.error || "Domain purchase failed",
          },
        });
        return NextResponse.json(
          { error: result.error || "Domain purchase failed" },
          { status: 400 }
        );
      }

      // Update website with domain info
      const updated = await prisma.website.update({
        where: { id },
        data: {
          domain: domain.toLowerCase().trim(),
          domainOrderId: result.orderId,
          domainPurchasePrice: result.chargedAmount,
          status: "DOMAIN_PURCHASED",
          statusMessage: "Domain purchased. Ready to create server.",
        },
      });

      // Log activity
      await prisma.websiteActivity.create({
        data: {
          websiteId: id,
          action: "DOMAIN_PURCHASED",
          details: `Purchased ${domain} for $${result.chargedAmount?.toFixed(2) || "N/A"}`,
        },
      });

      return NextResponse.json({
        success: true,
        website: updated,
        purchaseResult: result,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'search', 'check', or 'purchase'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Domain operation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operation failed" },
      { status: 500 }
    );
  }
}

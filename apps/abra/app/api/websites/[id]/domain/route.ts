import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  getNamecheapClientFromSettings,
  type DomainAvailability,
} from "@magimanager/core";

/**
 * Clean a domain input - strips protocol, www, trailing slashes
 * "http://www.example.com/" -> "example.com"
 */
function cleanDomainInput(input: string): string {
  let domain = input.toLowerCase().trim();

  // Remove protocol
  domain = domain.replace(/^https?:\/\//, "");

  // Remove www.
  domain = domain.replace(/^www\./, "");

  // Remove trailing slash and path
  domain = domain.split("/")[0];

  // Remove any remaining whitespace
  domain = domain.trim();

  return domain;
}

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

    // Handle "set" action first - doesn't need Namecheap client
    if (action === "set") {
      // Set an existing domain (user already owns it, no purchase needed)
      if (!domain || typeof domain !== "string") {
        return NextResponse.json(
          { error: "Domain is required" },
          { status: 400 }
        );
      }

      const cleanDomain = cleanDomainInput(domain);

      // Basic validation
      if (!cleanDomain.includes(".") || cleanDomain.length < 4) {
        return NextResponse.json(
          { error: "Please enter a valid domain (e.g., example.com)" },
          { status: 400 }
        );
      }

      // Check if domain is already used by another website
      const existingWebsite = await prisma.website.findFirst({
        where: {
          domain: cleanDomain,
          id: { not: id }, // Exclude current website
        },
      });

      if (existingWebsite) {
        return NextResponse.json(
          { error: `Domain "${cleanDomain}" is already in use by another website (${existingWebsite.name})` },
          { status: 400 }
        );
      }

      // Verify domain exists in Namecheap account (if Namecheap is configured)
      let domainVerified = false;
      let namecheapConfigured = false;
      try {
        const ncClient = await getNamecheapClientFromSettings();
        namecheapConfigured = true;
        const accountDomains = await ncClient.listDomains();
        const foundDomain = accountDomains.find(
          (d) => d.domain.toLowerCase() === cleanDomain
        );

        if (foundDomain) {
          domainVerified = true;
          if (foundDomain.isExpired) {
            return NextResponse.json(
              { error: `Domain "${cleanDomain}" has expired in your Namecheap account. Please renew it first.` },
              { status: 400 }
            );
          }
        } else {
          // Domain not found in Namecheap - check if user confirmed manual DNS
          const { confirmManualDns } = body;
          if (!confirmManualDns) {
            // Return special response asking user to confirm
            return NextResponse.json(
              {
                error: `Domain "${cleanDomain}" was not found in your Namecheap account.`,
                notInNamecheap: true,
                domain: cleanDomain,
                message: "This domain is not in your Namecheap account. You can either purchase it first, or proceed with manual DNS configuration at your current registrar."
              },
              { status: 400 }
            );
          }
          // User confirmed they want to proceed with manual DNS
          console.log(`Domain ${cleanDomain} not in Namecheap - user confirmed manual DNS`);
        }
      } catch (error) {
        // Namecheap not configured - that's okay, DNS can be managed manually
        console.log("Namecheap not configured, skipping domain verification");
      }

      // Update website with domain info (no purchase)
      const updated = await prisma.website.update({
        where: { id },
        data: {
          domain: cleanDomain,
          status: "DOMAIN_PURCHASED", // Same status, just didn't purchase through ABRA
          statusMessage: "Existing domain configured. Ready to create server.",
        },
      });

      // Log activity
      await prisma.websiteActivity.create({
        data: {
          websiteId: id,
          action: "DOMAIN_SET",
          details: domainVerified
            ? `Using existing domain: ${cleanDomain} (verified in Namecheap)`
            : `Using existing domain: ${cleanDomain} (DNS will need manual configuration if not in Namecheap)`,
        },
      });

      return NextResponse.json({
        success: true,
        website: updated,
      });
    }

    // Get Namecheap client for search/check/purchase
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

      const result = await client.checkDomain(cleanDomainInput(domain));
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

      const cleanPurchaseDomain = cleanDomainInput(domain);

      // Check if domain is already used by another website
      const existingPurchaseWebsite = await prisma.website.findFirst({
        where: {
          domain: cleanPurchaseDomain,
          id: { not: id }, // Exclude current website
        },
      });

      if (existingPurchaseWebsite) {
        return NextResponse.json(
          { error: `Domain "${cleanPurchaseDomain}" is already in use by another website (${existingPurchaseWebsite.name})` },
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
      const availability = await client.checkDomain(cleanPurchaseDomain);
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
      const result = await client.purchaseDomain(cleanPurchaseDomain);

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
          domain: cleanPurchaseDomain,
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
      { error: "Invalid action. Use 'search', 'check', 'set', or 'purchase'" },
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

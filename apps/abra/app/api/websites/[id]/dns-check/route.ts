import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import { getNamecheapClientFromSettings } from "@magimanager/core";

// GET /api/websites/[id]/dns-check - Check DNS status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    if (!website.domain) {
      return NextResponse.json(
        { error: "No domain configured" },
        { status: 400 }
      );
    }

    if (!website.dropletIp) {
      return NextResponse.json(
        { error: "No server IP configured" },
        { status: 400 }
      );
    }

    // Perform DNS lookup using DNS over HTTPS (Cloudflare)
    const dnsResults = await checkDnsRecords(website.domain);

    // Check if DNS is correctly pointing to our server
    const aRecordCorrect = dnsResults.aRecords.some(ip => ip === website.dropletIp);
    const wwwCorrect = dnsResults.wwwRecords.some(ip => ip === website.dropletIp) ||
                       dnsResults.wwwCname === website.domain ||
                       dnsResults.wwwCname === `www.${website.domain}`;

    // Check if site is reachable
    let siteReachable = false;
    let sslValid = false;
    try {
      const siteResponse = await fetch(`https://${website.domain}`, {
        method: "HEAD",
        redirect: "follow",
      });
      siteReachable = siteResponse.ok || siteResponse.status === 301 || siteResponse.status === 302;
      sslValid = true; // If fetch succeeded over HTTPS, SSL is valid
    } catch (e) {
      // Try HTTP if HTTPS fails
      try {
        const httpResponse = await fetch(`http://${website.domain}`, {
          method: "HEAD",
          redirect: "manual", // Don't follow redirects to avoid SSL issues
        });
        siteReachable = httpResponse.ok || httpResponse.status === 301 || httpResponse.status === 302;
      } catch {
        siteReachable = false;
      }
    }

    return NextResponse.json({
      domain: website.domain,
      expectedIp: website.dropletIp,
      dns: {
        aRecords: dnsResults.aRecords,
        wwwRecords: dnsResults.wwwRecords,
        wwwCname: dnsResults.wwwCname,
        aRecordCorrect,
        wwwCorrect,
        nameservers: dnsResults.nameservers,
      },
      site: {
        reachable: siteReachable,
        sslValid,
      },
      healthy: aRecordCorrect && siteReachable,
    });
  } catch (error) {
    console.error("DNS check failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DNS check failed" },
      { status: 500 }
    );
  }
}

// POST /api/websites/[id]/dns-check - Sync/fix DNS records
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json(
        { error: "Website not found" },
        { status: 404 }
      );
    }

    if (!website.domain || !website.dropletIp) {
      return NextResponse.json(
        { error: "Domain and server IP are required" },
        { status: 400 }
      );
    }

    // Get Namecheap client to update DNS
    let ncClient;
    try {
      ncClient = await getNamecheapClientFromSettings();
    } catch (error) {
      return NextResponse.json(
        { error: "Namecheap not configured. DNS must be updated manually at your domain registrar." },
        { status: 400 }
      );
    }

    // Update DNS records
    const success = await ncClient.pointToServer(website.domain, website.dropletIp);

    if (success) {
      // Log activity
      await prisma.websiteActivity.create({
        data: {
          websiteId: id,
          action: "DNS_SYNCED",
          details: `DNS A records synced to ${website.dropletIp}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: `DNS records updated. @ and www now point to ${website.dropletIp}. Changes may take a few minutes to propagate.`,
      });
    } else {
      return NextResponse.json(
        { error: "Failed to update DNS records" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("DNS sync failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DNS sync failed" },
      { status: 500 }
    );
  }
}

/**
 * Check DNS records using Cloudflare's DNS over HTTPS API
 */
async function checkDnsRecords(domain: string): Promise<{
  aRecords: string[];
  wwwRecords: string[];
  wwwCname: string | null;
  nameservers: string[];
}> {
  const results = {
    aRecords: [] as string[],
    wwwRecords: [] as string[],
    wwwCname: null as string | null,
    nameservers: [] as string[],
  };

  // Check A record for root domain
  try {
    const aResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
      { headers: { Accept: "application/dns-json" } }
    );
    const aData = await aResponse.json();
    if (aData.Answer) {
      results.aRecords = aData.Answer
        .filter((r: { type: number }) => r.type === 1) // A record
        .map((r: { data: string }) => r.data);
    }
  } catch (e) {
    console.error("A record lookup failed:", e);
  }

  // Check A record for www subdomain
  try {
    const wwwResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=www.${domain}&type=A`,
      { headers: { Accept: "application/dns-json" } }
    );
    const wwwData = await wwwResponse.json();
    if (wwwData.Answer) {
      results.wwwRecords = wwwData.Answer
        .filter((r: { type: number }) => r.type === 1) // A record
        .map((r: { data: string }) => r.data);

      // Check for CNAME
      const cname = wwwData.Answer.find((r: { type: number }) => r.type === 5);
      if (cname) {
        results.wwwCname = cname.data.replace(/\.$/, ""); // Remove trailing dot
      }
    }
  } catch (e) {
    console.error("WWW record lookup failed:", e);
  }

  // Check nameservers
  try {
    const nsResponse = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${domain}&type=NS`,
      { headers: { Accept: "application/dns-json" } }
    );
    const nsData = await nsResponse.json();
    if (nsData.Answer) {
      results.nameservers = nsData.Answer
        .filter((r: { type: number }) => r.type === 2) // NS record
        .map((r: { data: string }) => r.data.replace(/\.$/, ""));
    }
  } catch (e) {
    console.error("NS record lookup failed:", e);
  }

  return results;
}

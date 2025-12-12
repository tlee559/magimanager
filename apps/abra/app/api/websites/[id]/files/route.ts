import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  executeRemoteScript,
  waitForSsh,
} from "@magimanager/core";

/**
 * POST /api/websites/[id]/files - Upload files to running droplet
 *
 * This endpoint:
 * 1. Downloads the zip from Vercel Blob URL
 * 2. SSHes to the droplet and extracts files to /var/www/html
 * 3. Verifies the site is accessible at the IP level
 */
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

    if (!website.dropletIp) {
      return NextResponse.json(
        { error: "Droplet must be running with an IP address first" },
        { status: 400 }
      );
    }

    if (!website.sshPassword) {
      return NextResponse.json(
        { error: "SSH password not found. Please recreate the droplet." },
        { status: 400 }
      );
    }

    if (!website.zipFileUrl) {
      return NextResponse.json(
        { error: "No zip file uploaded. Please upload a zip file first." },
        { status: 400 }
      );
    }

    // Update status
    await prisma.website.update({
      where: { id },
      data: {
        status: "DEPLOYING",
        statusMessage: "Uploading files to server...",
      },
    });

    // Wait for SSH to be available (server might still be booting)
    console.log(`Waiting for SSH on ${website.dropletIp}...`);
    const sshReady = await waitForSsh(website.dropletIp, website.sshPassword, 60000);

    if (!sshReady) {
      await prisma.website.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: "Could not connect to server via SSH. Server may still be starting.",
        },
      });
      return NextResponse.json(
        { error: "Could not connect to server via SSH. Please try again in a few minutes." },
        { status: 500 }
      );
    }

    // Script to download and extract files
    const script = `
set -e

echo "=== Starting file upload process ==="

# Clear existing files in web root
echo "Clearing /var/www/html..."
rm -rf /var/www/html/* /var/www/html/.[!.]* 2>/dev/null || true

# Download the zip file
echo "Downloading zip file..."
curl -L -o /tmp/site.zip '${website.zipFileUrl}'

# Check if download succeeded
if [ ! -f /tmp/site.zip ]; then
  echo "ERROR: Failed to download zip file"
  exit 1
fi

# Check zip file size
ZIP_SIZE=$(stat -c%s /tmp/site.zip 2>/dev/null || stat -f%z /tmp/site.zip 2>/dev/null)
echo "Downloaded zip file: $ZIP_SIZE bytes"

# Extract to web directory
echo "Extracting files..."
cd /var/www/html
unzip -o /tmp/site.zip

# Handle nested directory - if zip contains a single folder, move contents up
DIRS=$(find . -maxdepth 1 -type d ! -name '.' | wc -l)
FILES=$(find . -maxdepth 1 -type f | wc -l)

if [ "$DIRS" -eq 1 ] && [ "$FILES" -eq 0 ]; then
  SINGLE_DIR=$(find . -maxdepth 1 -type d ! -name '.' -print -quit)
  echo "Moving contents from nested directory: $SINGLE_DIR"
  mv "$SINGLE_DIR"/* "$SINGLE_DIR"/.[!.]* . 2>/dev/null || true
  rmdir "$SINGLE_DIR" 2>/dev/null || true
fi

# Fix permissions
echo "Setting permissions..."
chown -R www-data:www-data /var/www/html
chmod -R 755 /var/www/html

# Clean up
rm -f /tmp/site.zip

# List what we deployed
echo "=== Files deployed ==="
ls -la /var/www/html/ | head -20

# Check if index file exists
if [ -f /var/www/html/index.html ] || [ -f /var/www/html/index.php ]; then
  echo "=== SUCCESS: Index file found ==="
else
  echo "=== WARNING: No index.html or index.php found ==="
fi

echo "=== File upload complete ==="
`;

    console.log(`Executing file upload script on ${website.dropletIp}...`);
    const result = await executeRemoteScript(
      website.dropletIp,
      website.sshPassword,
      script,
      { timeout: 120000 } // 2 minute timeout for large files
    );

    console.log("Script output:", result.stdout);
    if (result.stderr) {
      console.error("Script stderr:", result.stderr);
    }

    // Verify site is accessible at IP level
    let siteAccessible = false;
    let httpStatus: number | null = null;

    try {
      const testUrl = `http://${website.dropletIp}/`;
      console.log(`Testing site at ${testUrl}...`);

      const response = await fetch(testUrl, {
        method: "GET",
        headers: { "User-Agent": "MagiManager/1.0" },
      });

      httpStatus = response.status;
      siteAccessible = response.ok;

      console.log(`Site test result: ${httpStatus} ${response.statusText}`);
    } catch (error) {
      console.error("Site test failed:", error);
    }

    // Update website status
    if (siteAccessible) {
      await prisma.website.update({
        where: { id },
        data: {
          status: "FILES_UPLOADED",
          statusMessage: "Files uploaded successfully. Site is accessible at IP.",
        },
      });
    } else {
      // Files uploaded but site not responding - might be PHP error
      await prisma.website.update({
        where: { id },
        data: {
          status: "FILES_UPLOADED",
          statusMessage: httpStatus
            ? `Files uploaded. Site returned HTTP ${httpStatus}. Check nginx/PHP logs.`
            : "Files uploaded but site not responding. Check nginx/PHP configuration.",
        },
      });
    }

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "FILES_UPLOADED",
        details: `Files extracted to /var/www/html. HTTP status: ${httpStatus || "N/A"}`,
      },
    });

    return NextResponse.json({
      success: true,
      testUrl: `http://${website.dropletIp}/`,
      siteAccessible,
      httpStatus,
      scriptOutput: result.stdout,
    });
  } catch (error) {
    console.error("Failed to upload files:", error);

    // Try to update status to failed
    try {
      const { id } = await params;
      await prisma.website.update({
        where: { id },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "File upload failed",
        },
      });
    } catch {
      // Ignore update error
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload files" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/websites/[id]/files - Check if files are deployed and site is working
 */
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

    if (!website.dropletIp) {
      return NextResponse.json({
        filesDeployed: false,
        siteAccessible: false,
        error: "No droplet IP",
      });
    }

    // Test site at IP level
    let siteAccessible = false;
    let httpStatus: number | null = null;

    try {
      const testUrl = `http://${website.dropletIp}/`;
      const response = await fetch(testUrl, {
        method: "GET",
        headers: { "User-Agent": "MagiManager/1.0" },
      });

      httpStatus = response.status;
      siteAccessible = response.ok;
    } catch {
      // Site not accessible
    }

    return NextResponse.json({
      filesDeployed: ["FILES_UPLOADED", "DNS_CONFIGURING", "SSL_PENDING", "LIVE"].includes(website.status),
      siteAccessible,
      httpStatus,
      testUrl: `http://${website.dropletIp}/`,
    });
  } catch (error) {
    console.error("Failed to check files:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check files" },
      { status: 500 }
    );
  }
}

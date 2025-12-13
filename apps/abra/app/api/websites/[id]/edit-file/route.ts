import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/api-auth";
import {
  executeRemoteScript,
  waitForSsh,
  getSshCredentialsFromSettings,
} from "@magimanager/core";

/**
 * GET /api/websites/[id]/edit-file?file=index.html
 * Fetch a file from the server for editing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const fileName = searchParams.get("file") || "index.html";

    // Validate file name - only allow specific files for security
    const allowedFiles = ["index.html", "index.php", "play.html", "terms.html", "privacy.html"];
    if (!allowedFiles.includes(fileName)) {
      return NextResponse.json(
        { error: `File not allowed. Allowed files: ${allowedFiles.join(", ")}` },
        { status: 400 }
      );
    }

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    if (!website.dropletIp) {
      return NextResponse.json(
        { error: "No server IP. Deploy the website first." },
        { status: 400 }
      );
    }

    // Get SSH credentials
    let sshAuth;
    try {
      sshAuth = await getSshCredentialsFromSettings();
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "SSH credentials not configured" },
        { status: 400 }
      );
    }

    // Wait for SSH
    const sshReady = await waitForSsh(website.dropletIp, sshAuth, 30000);
    if (!sshReady) {
      return NextResponse.json(
        { error: "Could not connect to server via SSH" },
        { status: 503 }
      );
    }

    // Fetch file content
    const filePath = `/var/www/html/${fileName}`;
    const result = await executeRemoteScript(
      website.dropletIp,
      sshAuth,
      `cat "${filePath}" 2>/dev/null || echo "__FILE_NOT_FOUND__"`,
      { timeout: 30000 }
    );

    if (result.stdout.includes("__FILE_NOT_FOUND__")) {
      return NextResponse.json(
        { error: `File not found: ${fileName}` },
        { status: 404 }
      );
    }

    // Get list of available files
    const listResult = await executeRemoteScript(
      website.dropletIp,
      sshAuth,
      `ls -1 /var/www/html/*.html /var/www/html/*.php 2>/dev/null | xargs -n1 basename 2>/dev/null || echo ""`,
      { timeout: 15000 }
    );

    const availableFiles = listResult.stdout
      .split("\n")
      .map(f => f.trim())
      .filter(f => f && allowedFiles.includes(f));

    return NextResponse.json({
      success: true,
      fileName,
      content: result.stdout,
      availableFiles,
    });
  } catch (error) {
    console.error("Failed to fetch file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch file" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/websites/[id]/edit-file
 * Save edited file to the server
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const { fileName, content } = body as { fileName: string; content: string };

    // Validate file name
    const allowedFiles = ["index.html", "index.php", "play.html", "terms.html", "privacy.html"];
    if (!allowedFiles.includes(fileName)) {
      return NextResponse.json(
        { error: `File not allowed. Allowed files: ${allowedFiles.join(", ")}` },
        { status: 400 }
      );
    }

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 }
      );
    }

    const website = await prisma.website.findUnique({
      where: { id },
    });

    if (!website) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    if (!website.dropletIp) {
      return NextResponse.json(
        { error: "No server IP. Deploy the website first." },
        { status: 400 }
      );
    }

    // Get SSH credentials
    let sshAuth;
    try {
      sshAuth = await getSshCredentialsFromSettings();
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "SSH credentials not configured" },
        { status: 400 }
      );
    }

    // Wait for SSH
    const sshReady = await waitForSsh(website.dropletIp, sshAuth, 30000);
    if (!sshReady) {
      return NextResponse.json(
        { error: "Could not connect to server via SSH" },
        { status: 503 }
      );
    }

    // Create a backup first
    const filePath = `/var/www/html/${fileName}`;
    const backupPath = `/var/www/html/.backup_${fileName}_${Date.now()}`;

    // Escape content for bash - use base64 to safely transfer content
    const base64Content = Buffer.from(content).toString("base64");

    const script = `
set -e

# Backup existing file if it exists
if [ -f "${filePath}" ]; then
  cp "${filePath}" "${backupPath}"
  echo "Backup created: ${backupPath}"
fi

# Write new content (using base64 to handle special characters safely)
echo "${base64Content}" | base64 -d > "${filePath}"

# Set proper ownership and permissions
chown www-data:www-data "${filePath}"
chmod 644 "${filePath}"

# Verify the file was written
if [ -f "${filePath}" ]; then
  echo "SUCCESS: File saved"
  wc -c < "${filePath}"
else
  echo "ERROR: File not created"
  exit 1
fi
`;

    const result = await executeRemoteScript(
      website.dropletIp,
      sshAuth,
      script,
      { timeout: 30000 }
    );

    if (result.code !== 0 || !result.stdout.includes("SUCCESS")) {
      return NextResponse.json(
        { error: `Failed to save file: ${result.stderr || result.stdout}` },
        { status: 500 }
      );
    }

    // Log activity
    await prisma.websiteActivity.create({
      data: {
        websiteId: id,
        action: "FILE_EDITED",
        details: `Edited ${fileName} (${content.length} bytes)`,
      },
    });

    return NextResponse.json({
      success: true,
      fileName,
      bytesWritten: content.length,
    });
  } catch (error) {
    console.error("Failed to save file:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save file" },
      { status: 500 }
    );
  }
}

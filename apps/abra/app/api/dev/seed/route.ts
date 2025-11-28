import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// POST /api/dev/seed - Generate realistic test data
// DISABLED IN PRODUCTION - Only works in development
export async function POST() {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is disabled in production" },
      { status: 403 }
    );
  }

  try {
    // Create super admin user if it doesn't exist
    const existingSuperAdmin = await prisma.user.findUnique({
      where: { email: "admin@magimanager.com" },
    });

    let superAdmin;
    if (!existingSuperAdmin) {
      const hashedPassword = await bcrypt.hash("password123", 10);
      superAdmin = await prisma.user.create({
        data: {
          email: "admin@magimanager.com",
          name: "Super Admin",
          password: hashedPassword,
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          firstLogin: false, // Super admin doesn't need to change password
          unreadNotifications: 0,
        },
      });
      console.log("Super admin created");
    } else {
      superAdmin = existingSuperAdmin;
      console.log("Super admin already exists");
    }

    // Sample identities
    const identities = [
      {
        fullName: "John Martinez",
        dob: new Date("1985-03-15"),
        address: "456 Oak Avenue",
        city: "Austin",
        state: "TX",
        zipcode: "78701",
        geo: "United States",
        website: "https://johnmartinez.com",
      },
      {
        fullName: "Sarah Chen",
        dob: new Date("1990-07-22"),
        address: "789 Pine Street",
        city: "San Francisco",
        state: "CA",
        zipcode: "94102",
        geo: "United States",
        website: "",
      },
      {
        fullName: "Michael O'Brien",
        dob: new Date("1988-11-08"),
        address: "123 Maple Drive",
        city: "Chicago",
        state: "IL",
        zipcode: "60601",
        geo: "United States",
        website: "https://mobrien.net",
      },
      {
        fullName: "Emma Schmidt",
        dob: new Date("1992-05-30"),
        address: "321 Elm Boulevard",
        city: "Seattle",
        state: "WA",
        zipcode: "98101",
        geo: "United States",
        website: "",
      },
      {
        fullName: "David Kim",
        dob: new Date("1987-09-12"),
        address: "567 Birch Lane",
        city: "New York",
        state: "NY",
        zipcode: "10001",
        geo: "United States",
        website: "https://davidkim.io",
      },
    ];

    const createdIdentities = [];
    for (const identityData of identities) {
      const identity = await prisma.identityProfile.create({
        data: identityData,
      });
      createdIdentities.push(identity);

      // Create GoLogin profile for each identity (mock)
      const mockGoLoginProfileId = `gologin_${Math.random().toString(36).substring(2, 15)}`;
      await prisma.goLoginProfile.create({
        data: {
          identityProfileId: identity.id,
          profileId: mockGoLoginProfileId,
          profileName: `${identityData.fullName} - MagiManager`,
          status: "ready",
        },
      });
    }

    // Create ad accounts with various statuses
    const accountsData = [
      {
        identityIndex: 0,
        status: "provisioned",
        currentSpend: 0,
        adsCount: 0,
      },
      {
        identityIndex: 1,
        status: "warming-up",
        currentSpend: 20,
        adsCount: 8,
      },
      {
        identityIndex: 2,
        status: "warming-up",
        currentSpend: 35,
        adsCount: 15,
      },
      {
        identityIndex: 3,
        status: "ready",
        currentSpend: 50,
        adsCount: 20,
      },
      {
        identityIndex: 4,
        status: "ready",
        currentSpend: 50,
        adsCount: 18,
      },
    ];

    const createdAccounts = [];
    for (const accountData of accountsData) {
      const identity = createdIdentities[accountData.identityIndex];
      const mockCid = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;

      const account = await prisma.adAccount.create({
        data: {
          identityProfileId: identity.id,
          googleCid: mockCid,
          status: accountData.status,
          handoffStatus: accountData.status === "ready" ? "available" : "available",
          warmupTargetSpend: 50,
          currentSpendTotal: accountData.currentSpend,
          adsCount: accountData.adsCount,
        },
      });

      // GoLogin profiles are now created per identity, not per account
      createdAccounts.push(account);
    }

    return NextResponse.json({
      success: true,
      message: "Seed data created successfully",
      counts: {
        identities: createdIdentities.length,
        accounts: createdAccounts.length,
      },
    });
  } catch (error) {
    console.error("Failed to seed data:", error);
    return NextResponse.json(
      { error: "Failed to seed data" },
      { status: 500 }
    );
  }
}

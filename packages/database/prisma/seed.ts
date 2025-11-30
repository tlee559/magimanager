import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create or update super admin user
  const adminEmail = "admin@magimanager.com";
  const adminPassword = "admin123";
  const hashedPassword = await bcrypt.hash(adminPassword, 12);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    // Update existing admin to ensure correct role and password
    await prisma.user.update({
      where: { email: adminEmail },
      data: {
        password: hashedPassword,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        name: "Admin",
      },
    });
    console.log(`Updated existing admin user: ${adminEmail}`);
  } else {
    // Create new admin user
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Admin",
        password: hashedPassword,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        firstLogin: false,
      },
    });
    console.log(`Created admin user: ${adminEmail}`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

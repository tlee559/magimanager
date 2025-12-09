/**
 * One-time script to normalize existing identity data to Title Case
 * Run with: npx tsx scripts/fix-identity-casing.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function main() {
  console.log("Fetching all identities...");

  const identities = await prisma.identityProfile.findMany({
    select: {
      id: true,
      fullName: true,
      address: true,
      city: true,
      state: true,
    },
  });

  console.log(`Found ${identities.length} identities to process`);

  let updated = 0;

  for (const identity of identities) {
    const normalizedFullName = toTitleCase(identity.fullName);
    const normalizedAddress = toTitleCase(identity.address);
    const normalizedCity = toTitleCase(identity.city);
    // Keep state as-is if it's a 2-letter abbreviation
    const normalizedState = identity.state.length > 2
      ? toTitleCase(identity.state)
      : identity.state;

    // Only update if something changed
    if (
      normalizedFullName !== identity.fullName ||
      normalizedAddress !== identity.address ||
      normalizedCity !== identity.city ||
      normalizedState !== identity.state
    ) {
      await prisma.identityProfile.update({
        where: { id: identity.id },
        data: {
          fullName: normalizedFullName,
          address: normalizedAddress,
          city: normalizedCity,
          state: normalizedState,
        },
      });

      console.log(`Updated: ${identity.fullName} -> ${normalizedFullName}`);
      updated++;
    }
  }

  console.log(`\nDone! Updated ${updated} identities.`);
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

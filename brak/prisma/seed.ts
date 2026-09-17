import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@brak.app";
const DEMO_PASSWORD = "demo12345";

// [zapytanie, kategoria, cena_zaakceptowana|null, powód]
const SAMPLE_REQUESTS: [string, string, number | null, string][] = [
  ["Makita DDF484", "elektronarzędzia", 899, "BRAK_NA_STANIE"],
  ["Makita DDF484", "elektronarzędzia", 849, "BRAK_NA_STANIE"],
  ["Makita DDF484", "elektronarzędzia", null, "BRAK_NA_STANIE"],
  ["Rura PVC 160 mm", "hydraulika", 45, "BRAK_NA_STANIE"],
  ["Rura PVC 160 mm", "hydraulika", 42, "BRAK_NA_STANIE"],
  ["Kabel YDY 5x6", "kable", 12, "BRAK_NA_STANIE"],
  ["Kabel YDY 5x6", "kable", null, "WYCOFANY_Z_OFERTY"],
  ["Klej montażowy X", "chemia budowlana", 28, "BRAK_NA_STANIE"],
  ["Wkrętarka Bosch GSR 18V", "elektronarzędzia", 549, "BRAK_NA_STANIE"],
  ["Śruba M12x160", "złączki", 2, "BRAK_NA_STANIE"],
  ["Śruba M12x160", "złączki", null, "BRAK_NA_STANIE"],
  ["Zawór kulowy 1/2 cala", "hydraulika", 19, "BRAK_NA_STANIE"],
  ["Farba lateksowa biała 10L", "chemia budowlana", 139, "ZA_DROGO"],
  ["Przewód YDYp 3x2.5", "kable", 8, "BRAK_NA_STANIE"],
  ["Wiertło SDS+ 10mm", "elektronarzędzia", 22, "BRAK_NA_STANIE"],
];

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    console.log("Dane demo już istnieją — pomijam seed.");
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: "Hurtownia Elektryczna Testowa",
      slug: "hurtownia-testowa",
      industry: "hurtownia elektryczna",
    },
  });

  const location = await prisma.location.create({
    data: {
      organizationId: org.id,
      name: "Sklep główny",
      address: "ul. Testowa 1, Poznań",
    },
  });

  await prisma.subscription.create({
    data: { organizationId: org.id, plan: "FREE", status: "ACTIVE" },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const owner = await prisma.user.create({
    data: {
      organizationId: org.id,
      locationId: location.id,
      email: DEMO_EMAIL,
      passwordHash,
      name: "Jan Kowalski",
      role: "OWNER",
    },
  });

  const categoryCache = new Map<string, string>();
  async function categoryId(name: string): Promise<string> {
    const cached = categoryCache.get(name);
    if (cached) return cached;
    const category = await prisma.category.create({
      data: { organizationId: org.id, name },
    });
    categoryCache.set(name, category.id);
    return category.id;
  }

  const now = new Date();
  let created = 0;
  for (let monthOffset = 0; monthOffset < 2; monthOffset++) {
    for (const [rawText, category, price, reason] of SAMPLE_REQUESTS) {
      // liczba powtórzeń zależna od "popularności" pozycji na liście
      const repeats = Math.max(1, 5 - SAMPLE_REQUESTS.findIndex((r) => r[0] === rawText) % 5);
      for (let i = 0; i < repeats; i++) {
        const day = 1 + Math.floor(Math.random() * 27);
        const createdAt = new Date(
          now.getFullYear(),
          now.getMonth() - monthOffset,
          day,
          9 + Math.floor(Math.random() * 8)
        );
        await prisma.lostSaleReport.create({
          data: {
            organizationId: org.id,
            locationId: location.id,
            reportedById: owner.id,
            rawText,
            productName: rawText,
            categoryId: await categoryId(category),
            quantity: 1 + Math.floor(Math.random() * 2),
            acceptedPrice: price,
            reason,
            createdAt,
          },
        });
        created += 1;
      }
    }
  }

  console.log(`Zaseedowano organizację "${org.name}" (${created} zgłoszeń).`);
  console.log(`Zaloguj się: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

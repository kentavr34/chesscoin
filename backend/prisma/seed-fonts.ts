import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Fonts...");

  const fonts = [
    { name: "Inter",             description: "Modern default font",                priceCoins: 0n,           rarity: 'COMMON' },
    { name: "Roboto",            description: "Google's popular tech font",         priceCoins: 10_000n,      rarity: 'COMMON' },
    { name: "Montserrat",        description: "Elegant geometric sans-serif",       priceCoins: 50_000n,      rarity: 'RARE' },
    { name: "Playfair Display",  description: "Classic stylish serif",              priceCoins: 100_000n,     rarity: 'EPIC' },
    { name: "Comic Sans MS",     description: "Legendary fun font",                 priceCoins: 250_000n,     rarity: 'LEGENDARY' },
    { name: "JetBrains Mono",    description: "Hacker style monospace",             priceCoins: 150_000n,     rarity: 'EPIC' },
  ];

  for (const f of fonts) {
    await prisma.item.upsert({
      where: { id: `item_font_${f.name.replace(/\s+/g,'_').toLowerCase()}` },
      update: {},
      create: {
        id: `item_font_${f.name.replace(/\s+/g,'_').toLowerCase()}`,
        type: 'FONT',
        category: f.rarity === 'LEGENDARY' || f.rarity === 'EPIC' ? 'PREMIUM' : 'BASIC',
        name: f.name,
        description: f.description,
        priceCoins: f.priceCoins,
        rarity: f.rarity as any,
        isActive: true,
        sortOrder: 200,
      },
    });
  }

  console.log(`✅ ${fonts.length} Fonts seeded`);
  console.log("🎉 Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

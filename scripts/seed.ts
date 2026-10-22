// Seed Firestore + Storage from the SOP data:  npm run seed   (add -- --overwrite to reset)
import "./_env";

async function main() {
  const { seedAll } = await import("../src/lib/server/seed");
  const overwrite = process.argv.includes("--overwrite");
  const r = await seedAll({ overwrite });
  console.log(`Seeded ${r.items} stock items, ${r.menu} dishes (${r.photosUploaded} photos uploaded), ${r.suppliers} suppliers, ${r.plans} plans, ${r.posts} blog posts; recosted ${r.recosted} preps.`);
  process.exit(0);
}
main().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});

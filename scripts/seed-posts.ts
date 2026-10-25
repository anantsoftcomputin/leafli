// Add any starter blog posts that aren't in Firestore yet (never overwrites):  npm run seed:posts
import "./_env";

async function main() {
  const { seedPosts } = await import("../src/lib/server/seed");
  console.log(`Created ${await seedPosts()} blog posts.`);
  process.exit(0);
}
main().catch((e) => {
  console.error("Seeding posts failed:", e.message);
  process.exit(1);
});

// Verifies the server can reach Firestore and Storage with the configured credentials.
import "./_env";

async function main() {
  const { adminDb, adminBucket } = await import("../src/lib/firebase/admin");
  const t = Date.now();
  await adminDb.collection("meta").doc("healthcheck").set({ at: t });
  const back = await adminDb.collection("meta").doc("healthcheck").get();
  console.log("Firestore:", back.get("at") === t ? "OK" : "MISMATCH");
  const bucket = adminBucket();
  const [exists] = await bucket.exists();
  console.log(`Storage bucket ${bucket.name}:`, exists ? "OK" : "MISSING — enable Storage in the Firebase console");
}
main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

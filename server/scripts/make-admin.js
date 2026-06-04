// One-time bootstrap: promote a user to admin role in the database.
//
// BetterAuth's /admin/set-role endpoint requires an existing admin session to
// call, so the very first admin must be seeded directly in MongoDB.
//
// Usage:
//   MONGO_URI="mongodb+srv://..." DB_NAME=whiteboard node server/scripts/make-admin.js <email>
//
// After the first admin exists, subsequent promotions can use the REST API:
//   POST /api/auth/admin/set-role  { userId, role: "admin" }

const { MongoClient } = require("mongodb");

const email = process.argv[2];
if (!email) {
  console.error("Usage: MONGO_URI=... node server/scripts/make-admin.js <email>");
  process.exit(1);
}

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("Missing MONGO_URI environment variable");
  process.exit(1);
}

const dbName = process.env.DB_NAME || "whiteboard";

(async () => {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(dbName);
    const result = await db.collection("user").updateOne(
      { email: email.trim().toLowerCase() },
      { $set: { role: "admin" } }
    );
    if (result.matchedCount === 0) {
      console.error(`✗ No user found with email: ${email}`);
      process.exit(1);
    }
    console.log(`✓ ${email} is now admin`);
  } finally {
    await client.close();
  }
})();

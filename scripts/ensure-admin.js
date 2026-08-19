const admin = require(require("path").join(__dirname, "../functions/node_modules/firebase-admin"));
const path = require("path");

const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, "../backend/firebase-service-account.json");
const email = (process.env.ADMIN_EMAIL || "alikayracatalkaya@gmail.com").toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error("ADMIN_PASSWORD is required");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(require(saPath)) });
}

async function main() {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password, emailVerified: true });
    console.log("updated existing admin user", user.uid);
  } catch (e) {
    if (e.errorInfo?.code !== "auth/user-not-found" && e.code !== "auth/user-not-found") throw e;
    user = await admin.auth().createUser({
      email,
      password,
      emailVerified: true,
      displayName: "Kayra Çatalkaya",
    });
    console.log("created admin user", user.uid);
  }
  await admin.auth().setCustomUserClaims(user.uid, { admin: true });
  const db = admin.firestore();
  const ref = db.doc(`users/${user.uid}`);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      name: "Kayra Çatalkaya",
      email,
      theme: "soft",
      currency: "TL",
      language: "tr",
      owner_id: user.uid,
      created_at: admin.firestore.Timestamp.now(),
    });
  }
  console.log("admin claims set for", email);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * One-shot: create/reuse a backend service account for sakliov2 Storage
 * and write a gitignored key file. Does not print secrets.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const PROJECT = "sakliov2";
const ACCOUNT_ID = "saklio-backend";
const SA_EMAIL = `${ACCOUNT_ID}@${PROJECT}.iam.gserviceaccount.com`;
const ROLE = "roles/storage.objectAdmin";
const OUT = path.join(__dirname, "..", "backend", "firebase-service-account.json");

function cfg() {
  return JSON.parse(
    fs.readFileSync(path.join(os.homedir(), ".config", "configstore", "firebase-tools.json"), "utf8")
  );
}

async function token() {
  const t = cfg().tokens;
  if (!t?.access_token) throw new Error("Firebase CLI access token missing. Run firebase login.");
  if (t.expires_at && t.expires_at < Date.now() + 30_000) {
    throw new Error("Firebase CLI token expired. Re-run firebase login.");
  }
  return t.access_token;
}

async function gfetch(url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || text;
    const err = new Error(`${method} ${url} -> ${res.status}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`);
    err.status = res.status;
    err.json = json;
    throw err;
  }
  return json;
}

async function listAccounts() {
  const data = await gfetch(`https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts`);
  return data.accounts || [];
}

async function ensureAccount() {
  const accounts = await listAccounts();
  const existing =
    accounts.find((a) => a.email === SA_EMAIL) ||
    accounts.find((a) => (a.email || "").startsWith("firebase-adminsdk-") && a.email.endsWith(`@${PROJECT}.iam.gserviceaccount.com`));
  if (existing) {
    console.log(`Using service account ${existing.email}`);
    return existing.email;
  }
  console.log(`Creating service account ${SA_EMAIL}`);
  const created = await gfetch(`https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts`, {
    method: "POST",
    body: {
      accountId: ACCOUNT_ID,
      serviceAccount: { displayName: "Saklio Backend Storage" },
    },
  });
  return created.email;
}

async function ensureRole(email) {
  const policy = await gfetch(
    `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:getIamPolicy`,
    { method: "POST", body: {} }
  );
  policy.bindings = policy.bindings || [];
  let binding = policy.bindings.find((b) => b.role === ROLE);
  const member = `serviceAccount:${email}`;
  if (!binding) {
    binding = { role: ROLE, members: [] };
    policy.bindings.push(binding);
  }
  if (binding.members.includes(member)) {
    console.log(`IAM already has ${ROLE} for ${email}`);
    return;
  }
  binding.members.push(member);
  await gfetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:setIamPolicy`, {
    method: "POST",
    body: { policy },
  });
  console.log(`Granted ${ROLE} to ${email}`);
}

async function writeKey(email) {
  if (fs.existsSync(OUT)) {
    console.log("Key file already exists, leaving it in place.");
    return;
  }
  const data = await gfetch(
    `https://iam.googleapis.com/v1/projects/${PROJECT}/serviceAccounts/${email}/keys`,
    { method: "POST", body: { privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE" } }
  );
  const json = Buffer.from(data.privateKeyData, "base64").toString("utf8");
  JSON.parse(json); // sanity check
  fs.writeFileSync(OUT, json, { mode: 0o600 });
  console.log("Wrote gitignored service account key.");
}

(async () => {
  const email = await ensureAccount();
  await ensureRole(email);
  await writeKey(email);
  console.log("Done");
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

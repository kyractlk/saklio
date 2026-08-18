/**
 * Smoke-test Firebase Storage with the backend service account.
 * Prints only status — never tokens or key material.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEY_PATH = path.join(__dirname, "..", "backend", "firebase-service-account.json");
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "sakliov2.firebasestorage.app";
const OBJECT = `saklio/healthcheck/${Date.now()}.txt`;
const BODY = Buffer.from(`saklio-storage-ok ${new Date().toISOString()}`);

function b64urlJson(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64urlJson({ alg: "RS256", typ: "JWT" })}.${b64urlJson({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/devstorage.full_control",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key);
  const jwt = `${unsigned}.${sig.toString("base64url")}`;
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`token exchange failed: ${res.status}`);
  return json.access_token;
}

async function main() {
  if (!fs.existsSync(KEY_PATH)) throw new Error("service account file missing");
  const sa = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
  console.log(`project=${sa.project_id} bucket=${BUCKET}`);
  const token = await accessToken(sa);
  const headers = { Authorization: `Bearer ${token}` };
  const uploadUrl =
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(BUCKET)}/o` +
    `?uploadType=media&name=${encodeURIComponent(OBJECT)}`;
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "text/plain" },
    body: BODY,
  });
  if (!up.ok) throw new Error(`upload ${up.status}: ${await up.text()}`);
  console.log(`upload ok ${OBJECT}`);

  const getUrl =
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}/o/` +
    `${encodeURIComponent(OBJECT)}?alt=media`;
  const down = await fetch(getUrl, { headers });
  if (!down.ok) throw new Error(`download ${down.status}: ${await down.text()}`);
  const got = Buffer.from(await down.arrayBuffer());
  if (!got.equals(BODY)) throw new Error("download mismatch");
  console.log("download ok");

  const delUrl =
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}/o/` +
    `${encodeURIComponent(OBJECT)}`;
  const del = await fetch(delUrl, { method: "DELETE", headers });
  if (!del.ok && del.status !== 204) throw new Error(`delete ${del.status}: ${await del.text()}`);
  console.log("delete ok");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

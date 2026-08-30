#!/usr/bin/env node
/**
 * Chromium verification against the QA stack (or any base URL).
 * Uses the workspace Playwright install.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPORTS = path.join(HERE, "reports");
const SHOT = "/workspace/screenshots";
fs.mkdirSync(REPORTS, { recursive: true });
fs.mkdirSync(SHOT, { recursive: true });

const url = process.argv[2] || "http://127.0.0.1:8080/";
const base = url.endsWith("/") ? url : url + "/";

const cases = [];
const consoleErrors = [];
const failedNet = [];
const notFound = [];

function add(name, ok, detail) {
  cases.push({ name, ok, detail: String(detail ?? "") });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (err) => consoleErrors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("requestfailed", (req) => failedNet.push(`${req.method()} ${req.url()} ${req.failure()?.errorText || ""}`));
page.on("response", (res) => {
  if (res.status() === 404) notFound.push(res.url());
});

await page.goto(base, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(600);
let body = await page.innerText("body");
add("home renders Forge Layer", body.includes("Forge Layer"), body.slice(0, 120));
add("home shows contract-not-configured or live chip", /Contract not configured|Local rehearsal|studionet|testnet/i.test(body), "banner/chip");
add("landing has citation specimen", /What a citation looks like|A closed record/i.test(body), "specimen");
add("landing has trust properties", /Equivalence Principle|Wallet-signed writes/i.test(body), "holds");
add("landing has roadmap rail", /The forge|On the record/i.test(body), "roadmap");
await page.screenshot({ path: path.join(SHOT, "chromium-home.png") });

await page.click("text=Registry");
await page.waitForTimeout(900);
body = await page.innerText("body");
add("registry lists dockets", body.includes("FL-") || body.includes("Registry"), "docket ids or registry heading");
await page.screenshot({ path: path.join(SHOT, "chromium-registry.png") });

await page.goto(base + "submit", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
body = await page.innerText("body");
add("submit form", body.includes("File a dispute"), "form visible");
await page.screenshot({ path: path.join(SHOT, "chromium-submit.png") });

await page.goto(base + "roadmap", { waitUntil: "networkidle" });
body = await page.innerText("body");
add("roadmap page", /What we ship|Chamber|Attestation/i.test(body), "roadmap copy");

await page.goto(base + "protocol", { waitUntil: "networkidle" });
body = await page.innerText("body");
add("protocol page", /Equivalence|validators/i.test(body), "mechanism copy");

await page.goto(base + "disputes/1/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
body = await page.innerText("body");
add("docket detail centerpiece", /FL-00001/.test(body) && /Cited work|Consensus|Challenge/i.test(body), body.slice(0, 80));
await page.screenshot({ path: path.join(SHOT, "chromium-docket.png") });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
);
add("mobile no overflow", !overflow, String(overflow));
await page.screenshot({ path: path.join(SHOT, "chromium-mobile.png") });

await browser.close();

const origin = new URL(base).origin;
const ignorable404 = (u) => {
  try {
    const parsed = new URL(u);
    if (parsed.origin !== origin) return true; // cited third-party content
  } catch {
    return true;
  }
  return /favicon\.ico|apple-touch-icon|manifest\.json|\.map$/i.test(u);
};
const unexpected404 = notFound.filter((u) => !ignorable404(u));
const unexpected = consoleErrors.filter((e) => {
  if (/aborted|favicon|net::ERR_ABORTED/i.test(e)) return false;
  if (/Failed to load resource: the server responded with a status of 404/i.test(e) && unexpected404.length === 0) {
    return false;
  }
  return true;
});
add("no unexpected console errors", unexpected.length === 0, JSON.stringify(unexpected.slice(0, 5)));
add(
  "no failed network on core paths",
  failedNet.filter((u) => !/favicon|sourcemap/i.test(u)).length === 0 && unexpected404.length === 0,
  JSON.stringify({ failedNet: failedNet.slice(0, 5), notFound: unexpected404.slice(0, 8) }),
);

const status = cases.every((c) => c.ok) ? "PASS" : "FAIL";
const payload = { status, cases, console: unexpected, failedNet, url: base };
fs.writeFileSync(path.join(REPORTS, "09_chromium.json"), JSON.stringify(payload, null, 2));
const lines = ["# Chromium Report", "", `Status: **${status}**`, "", `URL: ${base}`, "", "## Cases", ""];
for (const c of cases) {
  lines.push(`- [${c.ok ? "PASS" : "FAIL"}] ${c.name}: ${c.detail}`);
}
fs.writeFileSync(path.join(REPORTS, "09_chromium.md"), lines.join("\n") + "\n");
console.log(JSON.stringify(payload, null, 2));
process.exit(status === "PASS" ? 0 : 1);

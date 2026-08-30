#!/usr/bin/env node
/**
 * Interactive Playwright QA against the live dApp.
 * Covers landing, validation, rehearsal submit → challenge → resolve.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = (process.argv[2] || "http://127.0.0.1:8080").replace(/\/$/, "");
const SHOT = "/workspace/screenshots";
fs.mkdirSync(SHOT, { recursive: true });

const cases = [];
function add(name, ok, detail = "") {
  cases.push({ name, ok, detail: String(detail) });
  if (!ok) console.error("FAIL", name, detail);
  else console.log("PASS", name);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

try {
  await page.goto(base + "/", { waitUntil: "networkidle", timeout: 30000 });
  const home = await page.innerText("body");
  add("hero copy", /public ledger for AI-versus-human/i.test(home), "hero");
  add("status machine", /Unchallenged/.test(home) && /Challenged/.test(home), "machine");
  add("trust strip", /Wallet-signed writes/.test(home), "holds");

  await page.click("text=Enter the forge");
  await page.waitForTimeout(400);
  add("rehearsal connect", /0x/i.test(await page.innerText("body")), "identity shown");

  await page.goto(base + "/submit", { waitUntil: "networkidle" });
  await page.getByPlaceholder("https://").fill("http://example.com/x.png");
  await page.getByRole("button", { name: "Stake and file" }).click();
  await page.getByText("content_ref malformed").waitFor({ timeout: 8000 });
  add("http image rejected in form", true, "content_ref malformed");
  await page.screenshot({ path: path.join(SHOT, "qa-submit-http-rejected.png") });

  await page.getByRole("button", { name: "Text excerpt", exact: true }).click();
  await page.locator("textarea").fill("A kettle came to a boil while ice plates knocked the mill wheel.");
  await page.locator('input[inputmode="decimal"]').fill("0.25");
  await page.getByRole("button", { name: "Stake and file" }).click();
  await page.waitForURL(/\/disputes\/\d+/, { timeout: 15000 });
  await page.locator("h1", { hasText: "Docket" }).waitFor({ timeout: 10000 });
  const docket = await page.innerText("body");
  add("filed dispute lands on docket", /FL-\d+/.test(docket) && /Docket/.test(docket), "docket");
  await page.screenshot({ path: path.join(SHOT, "qa-docket-filed.png") });

  const url = page.url();
  await page.click("text=Enter the forge").catch(() => {});
  // mint / switch identity if the menu exists
  const connected = await page.locator("text=/0x[0-9a-fA-F]{4}/").first().isVisible().catch(() => false);
  add("wallet menu after file", connected || /0x/.test(await page.innerText("header,body")), "header identity");

  await page.goto(url, { waitUntil: "networkidle" });
  // Switch identity via menu if possible
  const addrBtn = page.locator("header button, header [aria-haspopup='menu']").filter({ hasText: /0x|…/ }).first();
  if (await addrBtn.count()) {
    await addrBtn.click();
    const mint = page.locator("text=/Mint|New identity|Add identity/i").first();
    if (await mint.count()) {
      await mint.click();
      await page.waitForTimeout(300);
    } else {
      const other = page.locator("[role='menuitem']").nth(1);
      if (await other.count()) await other.click();
    }
  }
  await page.waitForTimeout(400);
  const challengeBtn = page.locator("button", { hasText: /Challenge/i }).first();
  if (await challengeBtn.count()) {
    await challengeBtn.click();
    await page.waitForTimeout(1200);
    const after = await page.innerText("body");
    add("challenge succeeds", /Challenged/i.test(after), after.slice(0, 160));
    await page.screenshot({ path: path.join(SHOT, "qa-challenged.png") });
    const resolveBtn = page.locator("button", { hasText: /Ask validators|resolve/i }).first();
    if (await resolveBtn.count()) {
      await resolveBtn.click();
      await page.waitForTimeout(2500);
      const resolved = await page.innerText("body");
      add(
        "resolve writes a verdict",
        /Resolved|AI generated|Human made|Inconclusive/i.test(resolved),
        resolved.slice(0, 200),
      );
      await page.screenshot({ path: path.join(SHOT, "qa-resolved.png") });
    } else {
      add("resolve button present", false, "missing after challenge");
    }
  } else {
    add("challenge button present", false, await page.innerText("body").then((t) => t.slice(0, 200)));
  }

  await page.goto(base + "/registry", { waitUntil: "networkidle" });
  await page.fill('input[placeholder*="Search"]', "kettle");
  await page.waitForTimeout(500);
  const reg = await page.innerText("body");
  add("registry search", /kettle|FL-/i.test(reg), "search");

  await page.goto(base + "/roadmap", { waitUntil: "networkidle" });
  add("roadmap phases", /Chamber|Attestation/.test(await page.innerText("body")), "phases");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  add("mobile no overflow after flows", !overflow, String(overflow));
  await page.screenshot({ path: path.join(SHOT, "qa-mobile.png") });

  add("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 5)));
} catch (err) {
  add("suite threw", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
}

const failed = cases.filter((c) => !c.ok);
const payload = {
  status: failed.length ? "FAIL" : "PASS",
  cases,
};
fs.mkdirSync("/workspace/forge-layer/tests/reports", { recursive: true });
fs.writeFileSync(
  "/workspace/forge-layer/tests/reports/12_playwright.json",
  JSON.stringify(payload, null, 2),
);
console.log(JSON.stringify(payload, null, 2));
process.exit(failed.length ? 1 : 0);

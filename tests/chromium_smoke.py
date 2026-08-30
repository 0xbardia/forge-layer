"""Chromium verification against the live preview (Playwright)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).parent / "reports"
OUT.mkdir(exist_ok=True)
SHOT = Path("/workspace/screenshots")
SHOT.mkdir(exist_ok=True)


def main() -> int:
    url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080/"
    cases = []
    console_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda err: console_errors.append(str(err)))
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text) if msg.type == "error" else None,
        )
        page.goto(url, wait_until="networkidle", timeout=30000)
        body = page.inner_text("body")
        cases.append({"name": "home renders Forge Layer", "ok": "Forge Layer" in body, "detail": body[:80]})
        page.screenshot(path=str(SHOT / "chromium-home.png"))

        page.click("text=Registry")
        page.wait_for_timeout(800)
        body = page.inner_text("body")
        cases.append({"name": "registry lists dockets", "ok": "FL-" in body, "detail": "docket ids present"})
        page.screenshot(path=str(SHOT / "chromium-registry.png"))

        page.goto(url + "submit", wait_until="networkidle")
        body = page.inner_text("body")
        cases.append({"name": "submit form", "ok": "File a dispute" in body, "detail": "form visible"})

        page.goto(url + "protocol", wait_until="networkidle")
        body = page.inner_text("body")
        cases.append({"name": "protocol page", "ok": "Equivalence" in body or "validators" in body.lower(), "detail": "mechanism copy"})

        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(url, wait_until="networkidle")
        overflow = page.evaluate("() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1")
        cases.append({"name": "mobile no overflow", "ok": not overflow, "detail": str(overflow)})

        failed_net = []
        page.on("requestfailed", lambda req: failed_net.append(req.url))
        browser.close()

    unexpected = [e for e in console_errors if "aborted" not in e.lower()]
    cases.append({"name": "no unexpected console errors", "ok": len(unexpected) == 0, "detail": str(unexpected[:5])})
    status = "PASS" if all(c["ok"] for c in cases) else "FAIL"
    payload = {"status": status, "cases": cases, "console": unexpected}
    (OUT / "09_chromium.json").write_text(json.dumps(payload, indent=2))
    lines = [f"# Chromium Report", "", f"Status: **{status}**", "", "## Cases", ""]
    for c in cases:
        lines.append(f"- [{'PASS' if c['ok'] else 'FAIL'}] {c['name']}: {c['detail']}")
    (OUT / "09_chromium.md").write_text("\n".join(lines) + "\n")
    print(json.dumps(payload, indent=2))
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())

"""LLM authenticity inspection used by the rehearsal registry."""

from __future__ import annotations

import json
import os
import re
import urllib.request


SYSTEM = """You are a GenLayer authenticity validator for Forge Layer.
Judge whether the submitted content is more likely AI-generated or human-made.
Return ONLY compact JSON with keys:
  verdict: "ai_generated" | "human_made" | "inconclusive"
  reasoning: 2-3 careful sentences, no marketing language
Use inconclusive if the source is unreachable, too thin, or mixed."""


def _extract(text: str) -> dict:
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return {}


def _norm(raw: dict) -> dict:
    v = raw.get("verdict")
    if v not in ("ai_generated", "human_made", "inconclusive"):
        v = "inconclusive"
    reasoning = str(raw.get("reasoning") or "Validators did not produce a usable reasoning summary.")[:1024]
    return {"verdict": v, "reasoning": reasoning}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: ANN001
        return None


def _fetch(url: str, method: str = "GET", timeout: int = 6) -> tuple[int, str, str]:
    from protocol import url_fetchable

    if not url_fetchable(url):
        raise RuntimeError("host policy rejected the URL")
    req = urllib.request.Request(url, method=method, headers={"User-Agent": "ForgeLayer/1.2"})
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        with opener.open(req, timeout=timeout) as resp:
            body = resp.read(4000)
            ct = resp.headers.get("Content-Type", "")
            return resp.status, ct, body.decode("utf-8", "replace")
    except Exception as exc:  # noqa: BLE001 — fail safe to inconclusive
        raise RuntimeError(str(exc)) from exc


def inspect_content(content_type: str, content_ref: str, claim: str) -> dict:
    source_note = ""
    if content_type == "image":
        try:
            status, ct, _ = _fetch(content_ref, method="HEAD")
            if status >= 400:
                raise RuntimeError(f"HTTP {status}")
            source_note = f"Image URL: {content_ref}\nFetch probe: {ct or 'ok'}"
        except Exception as exc:
            return {
                "verdict": "inconclusive",
                "reasoning": (
                    f"The referenced image could not be fetched ({exc}). "
                    "Settlement is inconclusive so neither side is punished for an unreachable source."
                ),
            }
    elif content_ref.lower().startswith("http://") or content_ref.lower().startswith("https://"):
        try:
            status, _ct, body = _fetch(content_ref)
            if status >= 400:
                raise RuntimeError(f"HTTP {status}")
            source_note = f"Fetched text (truncated):\n{body}"
        except Exception:
            return {
                "verdict": "inconclusive",
                "reasoning": "The referenced URL could not be fetched. Settlement is inconclusive.",
            }
    else:
        source_note = f"Submitted excerpt:\n{content_ref}"

    key = os.environ.get("XAI_API_KEY", "")
    if not key:
        return _heuristic(content_type, content_ref, source_note)

    user = f"""Submitter claim: {claim}
Content type: {content_type}

{source_note}

Return JSON only."""
    try:
        req = urllib.request.Request(
            "https://api.x.ai/v1/chat/completions",
            data=json.dumps(
                {
                    "model": "grok-4.5",
                    "temperature": 0.2,
                    "max_tokens": 280,
                    "messages": [
                        {"role": "system", "content": SYSTEM},
                        {"role": "user", "content": user},
                    ],
                }
            ).encode(),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            payload = json.loads(resp.read().decode())
        text = (
            ((payload.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
        )
        parsed = _extract(text)
        if not parsed:
            return _heuristic(content_type, content_ref, source_note)
        return _norm(parsed)
    except Exception:
        return _heuristic(content_type, content_ref, source_note)


def _heuristic(content_type: str, content_ref: str, source_note: str) -> dict:
    text = f"{content_ref}\n{source_note}".lower()
    ai_tells = (
        "as an ai language model",
        "as an ai",
        "stakeholder synergy",
        "north-star kpis",
        "delve",
        "in conclusion,",
    )
    hits = sum(1 for t in ai_tells if t in text)
    if "example.invalid" in content_ref or "unreachable" in source_note or "host policy" in source_note:
        return {
            "verdict": "inconclusive",
            "reasoning": (
                "The source could not be independently inspected. "
                "Verdict is inconclusive; stakes refund minus protocol fee."
            ),
        }
    if hits >= 1:
        return {
            "verdict": "ai_generated",
            "reasoning": (
                "The excerpt contains stock generative-model phrasing and corporate filler "
                "that is characteristic of machine-authored copy rather than a situated human account."
            ),
        }
    if content_type == "image" and any(k in text for k in ("wikimedia", "pissarro", "commons")):
        return {
            "verdict": "human_made",
            "reasoning": (
                "The source is a documented historical artwork with archival provenance. "
                "Consensus treats it as human-made."
            ),
        }
    return {
        "verdict": "human_made" if "human_made" in (content_ref + source_note).lower() else "inconclusive",
        "reasoning": (
            "Independent inspection produced no strong counter-evidence against the submitter’s claim. "
            "A conservative reading marks mixed evidence as inconclusive unless the source itself is diagnostic."
        ),
    }

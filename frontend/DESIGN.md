# Forge Layer — visual direction

Forge Layer should feel like a **notary archive inside a foundry**: quiet iron, stamped serials, bone-colored paper. It is a citable public record, not a dashboard and not a crypto carnival.

The interface is an editorial docket. Hairline rules do the work that cards usually do. Ember is a *state*, never a brand flood. Nothing here is purple, neon, gold-filled, or mesh-gradiented.

## Palette

| Token | Hex | Role |
| --- | --- | --- |
| Iron | `#0B0B0C` | Page ground |
| Elevated | `#131314` | Panels, header glass |
| Inset | `#080809` | Form wells, cited-work well |
| Subtle | `#1A1A1C` | Hover, skeleton |
| Bone | `#ECEAE6` | Primary text, primary buttons |
| Muted | `#9A9690` | Secondary labels, body support |
| Subtle text | `#6E6B66` | Captions, hints |
| Pale steel | `#DCD6CC` | Accent fill — **dark text on it** (`#0B0B0C`) |
| Border | `#2A2927` | Hairlines |
| Border strong | `#3D3B38` | Focus / hover edges |
| AI | `#8AA0AD` | AI-generated verdict |
| Human | `#93A58A` | Human-made verdict / success |
| Ember | `#C46A3A` | Forging, challenged, consensus in progress |
| Danger | `#C45C4A` | Failure, pause, validation |

No purple. No emoji. Ember appears only on in-progress and contested states.

## Type

- **Display — Newsreader.** Optical size, slightly tight tracking. Titles, cited excerpts, large numerals.
- **Body — Outfit.** Geometric, quiet UI chrome, labels, buttons.
- **Mono — IBM Plex Mono.** Docket ids (`FL-00012`), addresses, stakes, citations.

Three sizes on a given surface is enough. Tabular numerals on live stats. Uppercase 11px labels with wide letter-spacing (`0.16–0.22em`) mark metadata, never headlines.

## Motif

A **three-layer plate mark**: offset stacked bars, a tiny ember chip on the lowest plate. This is the only logo. Docket numbers are first-class type: `FL-00012`, always five digits, always the `FL-` prefix.

Hairline borders (`1px #2A2927`), not drop-shadow stacks. Concentric radii: panels (`12px`) larger than the controls inside them (`6px`). Status is a stamp, not a candy badge.

## Motion

150–250ms opacity and transform. No bounce. Consensus resolution is the one theatrical moment: stepped validator stages, not a generic spinner. Copy is “Validators are reasoning about this.”

`prefers-reduced-motion` collapses all of this to a snap.

## Layout

Max measure `72rem`. Asymmetric landing (copy left, live docket right). The per-dispute page is the centerpiece: cited work on the left, stakes / verdict / actions on the right. Mobile stacks; hairline nav becomes a horizontal scroller.

## Voice

Product name is **Forge Layer** everywhere — titles, headers, metadata. Filings are dockets. Wallets in rehearsal are wardens. Resolution is inspection, not “magic AI.”

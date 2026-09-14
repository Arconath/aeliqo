# Aeliqo Experience Profile — visual baseline

Status: proposed Aeliqo-owned convention, not an industry/W3C standard and not an approved screenshot. Implement it, inspect actual screens and preserve approved per-environment visual baselines.

## Default visual language

Neutral graphite surfaces, restrained indigo accent, clear typographic hierarchy, generous but purposeful spacing. No neon glows, background ornaments, unnecessary chart cards or permanently visible debugging panels. Both light and dark themes are first-class. App content must remain visually distinct from optional inspect/devtools surfaces.

Use system sans-serif by default; optional licensed application font may be supplied through tokens. Do not bundle a font without an explicit license/provenance review. Use a consistent optical size and stroke weight for a single reviewed icon family; controls always have accessible names independent of glyphs.

Token scale: 4, 8, 12, 16, 24, 32, 48px spacing; 12, 14, 16, 20, 24, 32, 48px typography reference with unitless line heights 1.25/1.5. These are CSS reference values; use rem for scalable text and allow zoom/reflow. Default control height 44px, compact fine-pointer variant 32px with verified target spacing. No global assumption that coarse pointer excludes keyboard. Content width and padding follow container, not user-agent name.

## Anatomy

Region: concise title and scope, optional primary controls, primary result, restrained status line, secondary detail only when task-relevant. Active filters and period are visible. Single-component embedding may omit region chrome. Table primary fields align consistently, numbers align logically for comparison, headers remain associated and horizontal overflow is explicit when essential. Do not wrap every value in a card.

Chart: honest axes/units, clear series identification, selection distinguishable without color alone, explicit empty/partial states and reachable exact values. No decorative gradients that obscure data. Dense labels may simplify but selected/reference values must remain accessible.

Form: stable label and help/error positions, clear required/read-only/pending distinction, summary links to errors, meaningful focus after failure, no disappearing draft. One primary action at a time; destructive operations visually distinct but not promoted by an AI layout decision.

## Structural adaptation

Wide inspection can use collection+detail; narrow inspection may use collection→detail with back context. Exact cross-column comparison retains a task-equivalent surface, possibly an essential scrollable table. Never silently convert a comparison to cards that make the task impossible. Required information access and required operations are both checked.

## Public surfaces

Main navigation: brand/home, Docs, Playground, Blog; GitHub on the right and a theme toggle. Footer/legal/about pages reuse one quiet content layout. Documentation uses one predictable navigation system with actual API references and compiled examples. Playground begins with a small useful task, not a wall of technical panels. MCP/BYOK/WebMCP status and scope are discoverable in a compact connection control. Inspect expands on demand.

Local Studio has four clear work areas: **Data & Meaning**, **Experience**, **Component Gallery**, and **Inspect**. It edits the same manifests as code; no independent opaque database is mandatory. Default app-user interfaces contain no unexplained compiler IDs or confidence scores. Component Gallery is the concrete rendering and state review surface; Inspect remains the secondary explanation surface.

## Required review

Check tokens and foreground/background contrast, borders, focus, hover, pressed, selected, disabled, loading, validation and forced-colors. Verify 320/360/768/1280px containers, 200% text and 400% zoom/reflow where applicable, RTL and long localization. Lock approved screenshots only after visual inspection. A token file is not pixel-perfect evidence.

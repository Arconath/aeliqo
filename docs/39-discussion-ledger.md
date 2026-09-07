# 39 — Register keputusan dari seluruh diskusi

Ini ringkasan keputusan dan koreksi yang mengikat implementasi, bukan transcript verbatim. Klaim assistant yang dibatalkan tidak menjadi requirement. User preference terbaru (versi 0.1.0) mengalahkan target 0.10.0 historis. Gambar generatif terakhir adalah ilustrasi, bukan kontrak capabilities.

| ID | Diskusi/feedback | Keputusan final |
|---|---|---|
| D01 | Product UI smart, bukan sekadar dashboard | Dapat tertanam di app region, standalone controls, collection/detail/forms, analytics bila diperlukan. |
| D02 | Framework milik sendiri | Aeliqo menyediakan visual/behavior/komponen sendiri; bukan wrapper produk existing customer. |
| D03 | Primitive + 2D | HTML/native controls dan visualisasi 2D; tidak membangun 3D, CAD, universal site generator. |
| D04 | Data mentah sudah dimiliki aplikasi | Aeliqo menyediakan catalog/semantics/planning/bounded evaluator; app tetap memiliki data/backend/auth/actions. |
| D05 | Belum fetch data bagaimana tahu? | Discovery metadata dahulu; sample terotorisasi berbatas bila schema tidak ada; tidak bulk-download tanpa alasan. |
| D06 | Tidak mau boilerplate schema | Import runtime schema/manifest, infer shape yang aman, tanyakan identity/grain/unit yang belum jelas. |
| D07 | Formula bukan beban user | Derivasi yang sudah valid otomatis; business definition melalui Define with AI atau Define manually. |
| D08 | Jangan semua approval enterprise | Task/session hypothesis low-risk boleh dengan policy/disclosure; reusable organizational meaning perlu authority. |
| D09 | AI jadi otak reasoning | AI menginterpretasi, investigasi, continuity, proposal meaning/query/UI, explanation; bukan trusted executor. |
| D10 | AI tidak boleh terlalu dibatasi | AI boleh mengusulkan registered composition/query AST; tidak arbitrary CSS/JSX/SQL executable. |
| D11 | Model jelek bisa halu | Tolak invalid effects, tangani material ambiguity, evidence-bound facts, manual fallback; residual valid-but-wrong risk diungkap. |
| D12 | Quality ceiling/floor | Target engineering, bukan jaminan zero defects; eval model tidak otomatis menaikkan permission. |
| D13 | MCP/WebMCP/BYOK | Protocol routes dan model supply berbeda; satu capability path, tanpa nested LLM wajib. |
| D14 | UI dipilih bagaimana | Task/result/operations/experience/environment/state; feasible candidates dahulu, preference kemudian. |
| D15 | Role -> Pattern -> Primitive | Pattern optional shortcut; bukan template funnel wajib. New conformant composition harus mungkin. |
| D16 | 71 komponen bikin combinatorial explosion? | Jumlah bukan masalah sendiri; index/prune/bounded composition/valid-incumbent. Jangan mengklaim brute-force yang tidak ada. |
| D17 | Responsif layar kecil | Actual container, text scale/input; simpan operation/meaning, bukan sekadar field reachable. |
| D18 | Mobile selalu cards? | Ditolak. Simultaneous table comparison mungkin memerlukan scroll yang benar; jangan hilangkan pilihan eksplisit. |
| D19 | UI state | Stable identity, draft, focus, IME, scroll/navigation dan pins dipertahankan melalui state-transfer. |
| D20 | Query vs UI | Code boundary terpisah; runtime memungkinkan materialization demand tanpa hidden semantic changes. |
| D21 | Satu task satu query? | Named outputs/DAG dan grain berbeda; view-only/form tidak memerlukan query palsu. |
| D22 | Trend mereka | Fixed/live cohort eksplisit; kalendar tiga bulan tidak otomatis 90 hari. |
| D23 | Banyak adapter? | Satu Application Data Contract lokal/HTTP; helper authoring optional; source knowledge tidak hilang secara magis. |
| D24 | Renderer agnostic | Semantic contracts platform-neutral; shared web implementation + thin bindings. Native platforms butuh implementation nyata. |
| D25 | Lit dipilih | Kandidat implementasi web dengan gate M0 SSR/forms/AT/perf; ganti melalui ADR hanya bila bukti blocker, tidak fork katalog. |
| D26 | DX mudah dan opinionated | Progressive entry points; Aeliqo presets/tokens/contracts; no giant config mandatory untuk satu component. |
| D27 | Designer mengikuti standar kita | Bounded variants/profiles/slots dengan defaults berkualitas; no arbitrary pixel scripting dari agent. |
| D28 | Performance wajib | Cold/warm budgets, bounded rendering/query/memory, targeted updates, real-browser/device evidence. |
| D29 | Pixel perfect | Approved deterministic environment baselines; bukan raster identik universal; no fake screenshot-live demo. |
| D30 | Complete component | Semua 71 entry mandatory selesai, tetapi bukan semua widget conceivable. |
| D31 | Website | Shared clean theme, full-width shell, Docs/Playground/Blog, GitHub kanan, theme toggle, reusable footer-content. |
| D32 | OSS -> business | Complete runtime/components/safety/a11y/agent/local tools OSS Apache-2.0; managed org services/support berbayar terpisah. |
| D33 | Rewrite kosong | Source tree bersih, atomic commits, history dan rollback tetap; tidak copy PoC runtime sebagai selesai baru. |
| D34 | Version sekarang | Target 0.1.0; npm immutability/semver reset preflight wajib; collision tidak diselesaikan unpublish. |
| D35 | Astra Medium/Luna Max | Verifikasi local IDs/efforts/spawn; max useful parallelism, one writer/worktree, independent review. |
| D36 | Master SoT | Master mengikat keputusan, domain docs memperinci; prompts/index/tests selaras; tidak menumpuk zip/blueprint lama. |
| D37 | Produk revolusioner/#1 | Ambisi kualitas/adopsi, bukan factual superiority. Buktikan held-out task/DX/perf/usability; tidak janji semua web universal. |
| D38 | AI guarantees/proves | Kata-kata tersebut tidak dipakai sebagai klaim umum. Runtime checks known contracts, bukan oracle business truth. |

## Koreksi dua gambar

Gambar “Universal Data Experience Framework” menambahkan vendor connectors, Kubernetes/autoscaling/multiregion, paid advanced connectors dan AI integration; itu bukan scope runtime atau batas OSS yang kita setujui. Gambar UI flow berikutnya lebih dekat tetapi keliru bila dibaca sebagai AI wajib sebelum semua UI, Table -> List -> Plot sebagai pipeline, atau “model lemah pasti aman”. Jangan menaruh kedua gambar sebagai source-of-truth di website/docs.

Diagram normatif berupa source Mermaid dalam `design/flows/`; menunjukkan direct bypass, optional reasoning, validation branches, queryless paths, evaluate versus present dan interaction loop. Gambar yang dirender kemudian harus dibandingkan terhadap source ini.

## Aturan perubahan berikutnya

Perubahan foundation memerlukan counterexample, invariant yang terdampak, alternatif, measured tradeoff, ADR, regression, update typed schemas/docs/tasks dan migration bila public contract berubah. Jangan merancang lapisan baru hanya karena menemukan sinonim menarik. Jangan mempertahankan desain yang gagal hanya karena sudah disebut final di chat.

## Edition 1.1 — developer-authored meaning clarification (8 September 2026)

The user explicitly requires a developer to specify additional/derived meaning with good DX. Retain two authoring modes (manual and AI-assisted), with code/config and Studio as manual surfaces. Register reviewed code definitions as application defaults; no forced end-user formula editing or per-question approval. Reuse schema, infer only confirmed metadata, keep UI selection separate, and preserve validation/host authorization. Code-owned definitions are read-only in Studio unless proposing a reviewed diff/version. This clarifies the existing manual code path; no foundation rewrite, new evaluator or release-number change. See MASTER-SOT sections 7 and 16, chapters 03/09/22, and S65–S67.

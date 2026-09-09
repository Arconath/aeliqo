# 41 — Standar engineering, scalability, dan maintainer operations

## Kualitas sebagai acceptance, bukan gelar

Target kualitas tertinggi diterjemahkan ke correctness, ergonomics, performance, accessibility, recovery, explicit ownership, dan reproducible evidence. Tidak ada label “nomor satu” atau “enterprise ready” sebelum comparative evidence yang memadai. Reference test lulus tidak membuktikan runtime lengkap.

## Modul dan dependency

Tetap enam target package publik, tanpa package per widget/operator/vendor: core berisi contracts/semantics/expressions/query/presentation/diagnostics; runtime mengoordinasikan effects; web memiliki native behavior/layout/geometry realization; React binding tipis; agent memiliki protocol/model ports; devtools adalah package publik optional. Testkit tetap source Apache-2.0 internal (`private: true`) untuk host/security tests, bukan package publik atau artefak rilis. App examples/site memakai built public entry points.

TypeScript strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess; unknown pada ingress divalidasi sebelum digunakan; tidak ada public any, broad catch-ignore, unsafe casts yang menghindari contract atau global mutable singleton. Public APIs tidak mengekspor tipe vendor sebagai core model. Concurrency membutuhkan ownership dari state/lease/request; jangan mengandalkan current global context.

Runtime schema source tunggal dipilih berdasarkan kemampuan output JSON Schema, bundle size dan inference pada M0/M1; jangan dual-maintain Zod/JSON Schema/TS. Standard Schema adalah boundary interoperability, bukan janji semua validator bisa introspection. Schema choice bukan alasan membangun framework schema baru.

## Code review dan desain API

Setiap public API mempunyai success/failure/cancel/cleanup contract, minimal example dan type-negative examples. Gunakan functions dan module kecil yang mempunyai invariant jelas. Generic abstraction harus memiliki dua consumer nyata, bukan mengantisipasi semua platform. Comments menjelaskan alasan, bukan paraphrase setiap baris. Hindari class Engine/Manager yang memiliki seluruh state dan IO.

Refactoring contract mendahului consumer parallelization. Pertahankan consistent names (proposal/bound/result/experience), document version terpisah package version, serializable plan yang tidak membawa credentials/callbacks. Components direct/semantic/region memakai implementation dan interaction contract yang sama.

## Data correctness/performance

Identity, grain, units, null, missing, denominator, ordering, time zone/calendar, capability and scope wajib eksplisit. Query executor bukan LLM. Pushdown yang sah; residual lokal hanya bila input complete dan budget terpenuhi. Decimal financial values memakai exact representation sesuai source contract; jangan otomatis float untuk money.

Immutable snapshots tidak berarti copy semua rows pada setiap event. Gunakan stable references, result leases, dependency indexes, structural sharing dan bounded caches. Critical paths seperti input/hover/selection tidak scan seluruh catalog atau invoke model. Backpressure membatasi buffers, node counts dan retained bytes. Disposal diuji dengan counters dan retained graph, bukan hanya heap sekali.

## Rendering dan accessibility

Native semantic HTML terlebih dahulu; custom elements pada meaningful boundaries, bukan tiap cell/mark. Lit dan D3 tidak boleh memiliki DOM yang sama. CSS mengerjakan layout yang memang CSS kuasai; presentation compiler memilih struktur, tidak menulis layout engine baru. Measurement dipisahkan dari mutation agar tidak layout-thrash/ResizeObserver oscillation.

Geometry budget terpisah analytical precision. SVG/Canvas switch tidak menghilangkan exact selected value atau akses keyboard. Readable data alternative bounded; jangan jutaan hidden focusable points. Field titles/unit/status authoritative dari descriptor; text model tidak masuk innerHTML/ARIA sebagai instruksi.

## Release evidence

Unit/property tests dan reference math bukan browser evidence. Browser snapshots bukan task usability. Axe bukan AA certification. Mock MCP/provider bukan actual agent evidence. Render callback bukan paint. Type compile bukan validator. Manual review bukan numeric oracle. Simpan semua sebagai evidence classes berbeda.

PR menjalankan focused deterministic tests dan boundary checks; nightly menjalankan full browser/visual/performance serta provider eval yang diotorisasi; RC menjalankan exact tarball consumers, manual AT/DX/design, artifact security, staging/rollback dan live identity. Skip release-critical tests tidak boleh memberi green readiness.

Coverage persentase hanya diagnostic. Minimum seluruh public transition/error paths dan named failure modes teruji. Tambahkan property/metamorphic tests untuk invariant matematis/state. Mutation testing terarah pada auth, scope, stale commit, claim numeric grounding dan rollback rules harus membuktikan mutant penting tertangkap. Jangan meningkatkan angka tes dengan menghitung tiap seeded iteration sebagai test independen.

## Scalability acceptance

Uji source besar tanpa mengunduh seluruhnya, catalog besar dengan paged discovery, banyak region dengan targeted notifications, concurrent queries dan agent requests, tenant/policy isolation, cached stale permissions, cancellation storms, low-power browser dan large text. Cold load, input p95, throughput, scan/transfer bytes dan memory plateau diukur terpisah. Satu O(1) reducer tidak membuktikan seluruh produk scalable.

Model/context biaya dipisahkan dari runtime resource. Planner punya bound dan typed exhaustion, bukan klaim optimal global. Hindari scaffolding CRDT/distributed cache/control plane sebelum ada kebutuhan yang dibuktikan; backend service bisa stateless horizontal scale melalui kontrak app, bukan runtime browser yang menjadi distributed system.

## OSS maintenance dan bisnis

Security contact, responsible disclosure, dependency updates, release notes, support matrix, deprecation policy, architecture docs dan contribution guide tetap public. Cloud business terpisah repo/license/build, tidak runtime entitlement gates. Integrasi auth/SSO hooks app dan audit export OSS; hosted SSO/governance service dapat paid.

Paid pilot mengukur repeated integration, real task completion, onboarding time, glue-code reduction, operational cost dan willingness to pay. Jangan proyeksikan revenue tanpa data. Pricing tidak per-render browser; pilih organization/editor/service/support setelah pilot. Cloud outage tidak boleh mematikan runtime yang sudah dikonfigurasi.

## Tidak menutupi pekerjaan eksternal

Agent tidak bisa membuat human usability interview atau screen-reader review dengan mengisi JSON PASS. Bila credential/real hardware/AT tidak tersedia, simpan artifact candidate dan blocker exact, lanjut task independen, jangan klaim selesai production. Owner access prompts tidak dibypass untuk mengejar deadline. Rilis dimungkinkan hanya untuk capabilities yang support boundary-nya benar-benar diuji, dengan experimental adapters yang disebut jelas.

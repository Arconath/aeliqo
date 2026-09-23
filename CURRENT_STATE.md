# CURRENT_STATE — Deep Product Audit Aeliqo

## Candidate implementation update — 2026-09-23

The audit below remains a historical snapshot of `04937d2`. The current
checkout started from fresh `origin/main` at
`c0b4a64dac6b507b8eeb50195e3bd36e43bb7eb8` and now contains a local
0.5.0 candidate change. The first clean `pnpm check` passed 87/87 at `58f13a9`,
but independent whole-diff review found React and documentation corrections
that require a new clean-source run. For final qualification, read
`artifacts/product-ci/ci.json` and require its source SHA to equal `HEAD` with
`sourceChangedDuringRun: false`; the historical audit below does not certify
this change.

The candidate adds an installed-package React local path
`useDataSurface({data,getRowId})` + `AdaptiveSurface`, runtime-owned local
data evaluation, monotonic source revisions, committed Task/Result evidence
for the shared resolver, native table/cards selection from measured container
size, stable selectors, and a denied/disposed guard for explicit React views.
The optional agent's no-auth profile is restricted to allowlisted loopback
origins. Public package and site docs now describe the candidate and distinguish
it from published stable 0.4.2.

Focused worktree checks passed: vNext 270/270, vNext browser 33/33, runtime
data 109/109, release tooling 31/31 with five packed package consumers,
docs artifact 10/10 and 71/71 catalog inventory, catalog examples 3/3,
site build/test, lint, format, and bundle 6/6. The measured `region-table`
bundle is 163,835 bytes gzip against the unchanged 163,840-byte cap, leaving
a five-byte margin. These checks were run before the accepted clean-source
matrix and are not registry or production evidence.

An external workflow published `0.5.0-rc.1` for all five packages from the
earlier `c0b4a64` source while this newer candidate was being qualified. The
`next` tag points to that RC; `latest` remains `0.4.2`. This task has not
published its source or an image, tag, or website release. Live paid-model
evaluation, corrected-source owner publication, GitOps promotion, and
production readback remain separate gates.
Read-only production `/version` responses on 2026-09-23 still identify SDK/site
revision `9092d6cff454b81cd623a7a4be7621c6a750d9c7` and version `0.4.2`;
health, readiness, docs start, and playground routes returned 200. No vNext
image digest or production readback is evidenced.
The examined legacy routes, redirects, package aliases, migration docs, and
release workflows still have active consumers or rollback duties; none was
deleted speculatively.

The post-review local journey suite now passes 281/281 vNext tests and 47/47
vNext browser tests; the bundle gate passes 6/6 with the same five-byte
`region-table` margin. J1 has synthetic manual/connected-agent parity on one
scoped target. J2 has an actual browser trend, approved daily values,
clarification, keyboard and automated accessibility checks. J3 has a registered
three-need runtime plan and separate three-child browser rendering; these are
not yet one automatic end-to-end browser composition. No live model or human
adoption result is implied by these local fixtures.

The exact-source matrix at `587430c` passed 83 gates, including Chromium,
Firefox, and WebKit visual suites, then failed vNext browser gate 84 when the
Vite fixture page reloaded during Compare (46/47 browser tests passed). The
server fixture now explicitly prebundles React and disables late dependency
discovery; focused browser verification passed 47/47 and 141/141 on three
repeats. This is a correction, not a passed final matrix. The local candidate
also merged the newer `origin/main` commit `368cffc`, which removed automatic
production promotion. A fresh full `pnpm check` is required on the final clean
SHA before local qualification.

Tanggal audit: 2026-09-21
Pemilik/repository: Arconath / Arconath/aeliqo
Produk yang diaudit: **Aeliqo** — satu produk/framework; audit ini tidak mencakup produk Arconath lain.
Bahasa laporan: Bahasa Indonesia.

> Dokumen ini adalah snapshot audit produk, bukan rencana implementasi. Audit tidak
> mengubah source implementation, refactor, dependency, konfigurasi, deployment,
> atau environment produksi. Perubahan yang diizinkan dari pekerjaan audit ini
> hanya file CURRENT_STATE.md di root repository.

## Cara membaca status

Audit membedakan status berikut agar kemampuan tidak dibesar-besarkan:

| Status | Arti |
|---|---|
| INTENDED | Dinyatakan oleh spec, docs, atau release plan; belum cukup sebagai bukti runtime. |
| IMPLEMENTED | Ada jalur production source yang relevan dan dapat ditelusuri. |
| VERIFIED-BOUNDED | Terbukti dalam test/fixture/profile tertentu pada source SHA audit; bukan klaim universal. |
| OBSERVED | Terlihat melalui browser/runtime test pada surface yang disebut. |
| PARTIAL | Sebagian kontrak terbukti, tetapi ada batas penting atau bukti yang belum lengkap. |
| UNKNOWN | Tidak ada bukti yang cukup dalam scope audit. |
| BLOCKED | Tidak dapat dinyatakan selesai karena release, permission, credential, environment, atau bukti eksternal belum ada. |

Semua klaim penting memakai evidence ID seperti [E14]. Planning artifact,
declaration-only probe, mock provider, dan test yang source SHA-nya berbeda tidak
diperlakukan sebagai bukti produksi.

## 1. Metadata dan snapshot sumber

### 1.1 Snapshot yang diaudit

| Field | Nilai |
|---|---|
| Checkout | /Users/nino/WORKS/Personal/Idea/Project/products/aeliqo |
| Branch | codex/aeliqo-vnext |
| Source SHA saat audit | 04937d21df75cfb32a891d4f52de9da5a6a7e678 |
| Upstream branch | origin/codex/aeliqo-vnext |
| Remote | git@github.com:Arconath/aeliqo.git |
| Root package | aeliqo, private workspace, version 0.5.0 |
| Release metadata | version 0.5.0, line 0.5, status candidate, previous 0.4.2 |
| Read-only npm preflight | 0.5.0 is available for future publication on all five package names; no publish performed |
| Public packages | @aeliqo/core, @aeliqo/runtime, @aeliqo/web, @aeliqo/react, @aeliqo/agent |
| Site package | @aeliqo/site 0.4.2, private application |
| Toolchain | Node 24.20.0, pnpm 11.24.0 |
| Audit environment | macOS, local checkout; tidak memakai credential atau data produksi |
| Audit scope | source, docs, catalog, examples, tests, local site/runner code, fresh quality matrix |

Package manifests menunjukkan kelima public package berada pada 0.5.0; site
tetap 0.4.2 karena merupakan aplikasi private, bukan package publik. Root
README dan docs menyebut 0.4.2 sebagai stable yang sudah terbit dan 0.5.0
sebagai breaking candidate yang belum dipublish. [E01] [E02]

### 1.2 Kedalaman pemeriksaan

Audit ini melakukan inventory luas lalu membaca mendalam jalur kritis. Ini
bukan klaim bahwa setiap baris seluruh repository telah dibaca semantik.

| Area | Inventory | Dibaca mendalam | Batas coverage |
|---|---:|---|---|
| packages/core/src | 145 file / 20.115 baris | resource/feature, intent compiler, query, semantics, presentation contracts | Helper kecil dan semua kombinasi schema tidak dibaca baris demi baris. |
| packages/runtime/src | 141 file / 24.229 baris | authority, runtime controller, scope, surface, results, data, presentation | Adapter host produksi tidak tersedia. |
| packages/web/src | 232 file / 36.413 baris | app facade, mount/render, Region adaptation, registry; behavior lewat component suites | Semua implementasi komponen tidak direview manual satu per satu. |
| packages/react/src | 22 file / 1.083 baris | exports, provider/Region, SSR dan consumer coverage | Tidak ada aplikasi pelanggan eksternal dalam scope. |
| packages/agent/src | 99 file / 12.013 baris | endpoint, capability registry, model loop, MCP, WebMCP, browser bridge | Tidak ada provider live dan client eksternal live. |
| apps/site/src + runner | 24 file / 3.694 baris + 4 file / 781 baris | landing, docs shell, playground, BYOK, local runner | Tidak diverifikasi setelah deployment publik. |
| docs/site | 50 page + 71 component docs | route metadata, product promise, support/release/security docs | Accuracy prose tetap memiliki drift yang dicatat di findings. |
| Tests | 422 source file, 223 test/spec file | quality matrix, runtime/browser/security/consumer suites | Fresh full run dicatat di §13. |

Sumber inventory dan implementasi utama: [E04] [E05] [E06] [E07] [E08] [E09].

## 2. Executive summary

Aeliqo adalah framework TypeScript open-source untuk menghubungkan intent
aplikasi yang tervalidasi, data dan authority milik host, Result/Task yang
bounded, pemilihan presentation yang terdaftar, dan lifecycle Region/surface.
Agent bersifat adapter opsional; jalur manual tidak membutuhkan model. Product
promise ini konsisten di root README, product docs, dan vNext spec. [E02] [E03]

### Kesimpulan audit

**Implementasi kandidat secara teknis koheren dan jalur manual no-AI terbukti
kuat dalam fixture/suite bounded. Namun Aeliqo 0.5.0 belum siap dinyatakan
sebagai release publik atau production-proven:** registry publication,
deployment/runtime smoke, live provider quality, native WebMCP, production
backend/scale, dan human usability/host-only comparison belum dibuktikan.

### Ringkasan capability

| Kelompok | Penilaian | Alasan ringkas |
|---|---|---|
| Core contracts, schema, intent, Task/query | VERIFIED-BOUNDED | Unit, semantic, query, vertical, dan consumer tests melewati quality matrix. |
| Runtime authority, Results, Region/surface lifecycle | VERIFIED-BOUNDED | Scope fence, stale/cancel/denied, cache partition, disposal, dan action tests tersedia. |
| Web Components, adaptive Region, 71 catalog components | VERIFIED-BOUNDED + OBSERVED | Browser, visual, a11y, catalog example, dan consumer suites; bounded profiles. |
| React/Vue/Next/SSR/static-island | VERIFIED-BOUNDED | Hanya versioned fixtures yang disebut support matrix, bukan semua aplikasi. |
| Local data dan synthetic HTTP protocol | VERIFIED-BOUNDED | Protocol/source fixtures; remote production system tidak tersedia. |
| Agent tools, MCP, simulated WebMCP, model loop | VERIFIED-BOUNDED | Structured tools dan containment diuji; native/live provider belum. |
| DeepSeek BYOK di playground | IMPLEMENTED / synthetic provider VERIFIED-BOUNDED | Direct browser flow dan secret hygiene diuji dengan route interception; live call tidak dilakukan. |
| Production release/publish/deploy | BLOCKED | Metadata masih candidate; tidak ada bukti registry, image, deployment, atau runtime smoke. |
| Product-market fit, usability, cost at scale | UNKNOWN | Tidak ada user study, host-only comparison, telemetry produksi, atau paid/live evaluation. |

### Hal yang paling bernilai

1. Satu jalur runtime dipakai oleh control biasa, application code, dan agent
   proposal; tidak ada product requirement untuk AI.
2. Identity, scope activation epoch, surface generation, authority revision,
   source revision, Result pins, dan presentation receipts dibuat eksplisit.
3. Error, stale, denied, partial, unsupported, cancelled, dan no-commit tidak
   disamarkan menjadi success.
4. Public site dan catalog memberi contoh nyata: people browse/filter/detail,
   product comparison, support action/form, knowledge search, serta trend
   headcount.

### Blocker utama

1. 0.5.0 masih candidate dan belum boleh dipresentasikan sebagai package
   stable/published.
2. 71 halaman component masih menulis Aeliqo 0.4.2, sementara generated site
   mengambil version candidate 0.5.0; ini membuat version note publik
   misleading.
3. Bukti live/production dan human value belum tersedia, sehingga klaim harus
   dibatasi pada profile fixture yang disebut.

## 3. Identitas produk, pengguna, nilai, dan scope

### 3.1 Identitas dan positioning

| Dimensi | Current state |
|---|---|
| Produk | Adaptive Application UI framework untuk application-owned meaning, data, authority, actions, dan registered presentation. |
| Primary buyer/user teknis | Tim product engineering yang mengulang wiring query state, responsive view, failure/cancellation, accessibility, dan optional agent tooling. |
| End-user workflow | Browse, filter, compare, detail, form/edit, action review/execute, knowledge search, dan bounded analytics/trend. |
| Product boundary | Library/runtime yang dipasang di application; bukan hosted cloud, router, ORM, global state manager, billing, SSO, marketplace, atau no-code builder. |
| AI dependency | Tidak ada untuk jalur manual; model/MCP/WebMCP/BYOK opsional. |
| Authority owner | Host application/server; browser dan agent hanya diberi bounded capability. |
| Differentiator yang dimaksud | Koordinasi semantic intent → bounded evaluation → registered view → scoped lifecycle, bukan sekadar table-to-chart. |

Spec sendiri menyatakan bahwa source inspection tidak membuktikan PMF dan value
harus dibandingkan dengan host-only implementation serta usability task.
[E03]

### 3.2 Persona dan tanggung jawab

| Persona | Kebutuhan | Yang dimiliki |
|---|---|---|
| Host developer | Mendefinisikan resource, identity, meaning, data adapter, UI/action | Source of truth, routes, server auth, business effects |
| End user | Melihat/filter/mengubah data dan mempertahankan pekerjaan saat layout berubah | Intent melalui control; bukan authority |
| Application authority adapter | Menjawab principal, scope, policy, grants, revision | Authentication dan authorization nyata |
| Optional agent/model | Menemukan capability dan mengusulkan intent/action | Tidak boleh HTML, code, grant, unregistered view, atau self-confirm |
| Operator/release owner | Menilai compatibility dan release | Registry, image, deployment, rollback, dan permission terpisah |

### 3.3 In-scope vs out-of-scope

**Termasuk:** five public packages, component catalog, semantic/query engine,
runtime data/Results/Regions/actions, Lit/Web Components, React binding,
framework fixtures, agent protocol adapters, public docs, playground, local
runner, dan release/quality evidence.

**Tidak termasuk:** data pelanggan nyata, backend bisnis tertentu, database
vendor tertentu, production tenancy, published npm/image, hosted Aeliqo Cloud,
billing/SSO/SCIM, universal framework/provider support, live model evaluation,
native WebMCP qualification, serta user research.

## 4. Source-of-truth dan konflik

### 4.1 Hirarki bukti

| Prioritas | Source | Dipakai untuk |
|---:|---|---|
| 1 | Current source + fresh tests pada SHA audit | Apa yang benar-benar berjalan di checkout ini. |
| 2 | Catalog, declarations, examples, generated-doc verification | Surface publik dan compatibility yang diuji. |
| 3 | Authored docs | Product promise, usage boundary, dan disclosure. |
| 4 | 01-SPEC, 02-EXECPLAN, 03-ACCEPTANCE, 07-EXECUTION-STATE | Intended contract dan planned evidence; bukan runtime proof sendiri. |
| 5 | Existing artifacts dengan source SHA lain | Historical/supporting evidence saja; tidak cukup untuk current claim. |

03-ACCEPTANCE.md sendiri menulis status handoff NOT RUN sebagai planning
artifact dan melarang menganggap declaration-only probe sebagai product proof.
Dalam audit ini planning state dipisahkan dari fresh pnpm check. [E03] [E12]

### 4.2 Konflik atau drift yang ditemukan

| ID | Konflik | Dampak | Status |
|---|---|---|---|
| DOC-01 | Semua 71 docs/site/components/*.md mengandung Aeliqo 0.4.2. pada section Version; generated shell membaca RELEASE_VERSION=0.5.0 dan label candidate. | Pembaca dapat mengira component contract masih stable 0.4.2 atau tidak tahu apakah page sudah untuk candidate. | Confirmed, medium |
| DOC-02 | docs/site/pages/app-api.md mendeskripsikan “Aeliqo 0.4 application facade” sedangkan source/release line candidate 0.5.0. | Search/reference copy tidak sinkron. | Confirmed, low-medium |
| REL-01 | Root README/install docs sengaja menunjukkan stable 0.4.2 dan candidate 0.5.0; semua public package manifest lokal sudah 0.5.0. | Ini benar sebagai cutover state, tetapi package install eksternal 0.5.0 belum boleh diasumsikan tersedia. | Confirmed release blocker |
| PLAN-01 | 07-EXECUTION-STATE dan planning validation memuat checkpoint/source reference lama serta status planning. | Dapat menyesatkan bila dibaca sebagai bukti current tanpa source SHA reconciliation. | Confirmed, evidence hygiene |
| SITE-01 | @aeliqo/site tetap version 0.4.2, berbeda dari lima public packages. | Tidak otomatis bug karena site private app, tetapi perlu tetap dijelaskan pada release dashboard. | Known/intentional-looking; verify at release |

Tidak ada perubahan source untuk memperbaiki drift di atas selama audit.

## 5. Capability matrix

| Capability | Intended | Implemented path | Evidence/current boundary | Status |
|---|---|---|---|---|
| Immutable resource/feature definition | Feature tidak menyimpan session/credential/mutable state | defineResource, defineDataFeature, defineFeature | Schema, identity, references, duplicate revision, parser tests | VERIFIED-BOUNDED |
| Structured intent parsing | Unknown/untrusted input harus bounded | Core contract parser + field/domain validation | Invalid field/filter/domain/identity cases | VERIFIED-BOUNDED |
| Standard intent compilation | browse/detail/compare/analyze/create/edit → Task/query | packages/core/src/app/intent.ts | Query fields, identity predicates, meanings/time buckets, registered view | VERIFIED-BOUNDED |
| Custom capability intent | Non-data feature tidak difabrikasi sebagai table | Feature capability/view/intent registry | Capability/view refs dan runtime schema | VERIFIED-BOUNDED |
| Semantic meaning/metric | Grain, unit, ratio, precision, ambiguity dijaga | Meaning registry/validation and query evaluator | Semantic fixtures, unsupported/ambiguous cases | VERIFIED-BOUNDED |
| Query planning/evaluation | Bounded plan dengan source/scope/policy/catalog pins | Core query planner/evaluator + runtime evaluation | Result completeness/precision/unknown, limits, authorization | VERIFIED-BOUNDED |
| Local data source | Small authorized snapshot works without backend/model | Runtime local DataService/source adapters | Synthetic people/product fixtures, update and stale tests | VERIFIED-BOUNDED |
| HTTP data protocol | Remote data/credential stays at server boundary | http-client, http-server, capability negotiation | Protocol and consumer fixtures; no customer backend | VERIFIED-BOUNDED |
| Custom DataService | Arbitrary host adapter possible | Runtime data interfaces | Contract tests; actual mapping remains host-owned | IMPLEMENTED |
| Result store | Result evidence is cached/revocable/bounded | TTL, byte/entry caps, pins, revoke, supersede | Result and auth-retention tests | VERIFIED-BOUNDED |
| Region lifecycle | mount → render → commit → subscribe → unmount/dispose | Runtime/web app facade | Browser and lifecycle suites | VERIFIED-BOUNDED |
| Scoped surface | Same feature can have isolated live instances | immutable SurfaceAddress, scope registry, generation | multi-surface and A-B-A/stale tests | VERIFIED-BOUNDED |
| Voluntary/forced scope change | Draft guard differs from revocation | Scope controller transition/fence/recheck | Scope race, deny, fence, recovery tests | VERIFIED-BOUNDED |
| Adaptive presentation | Registered views adapt to environment | resolver, manifests, Region adaptation queue | determinism, candidate eligibility, visual/browser tests | VERIFIED-BOUNDED |
| Interaction preservation | Focus/IME/pointer/edit state blocks unsafe adaptation | RegionInteractionGuard, previous-view retention | browser focus/composition/resize suites | VERIFIED-BOUNDED |
| Web Components | Standalone, semantic, and Region surfaces | packages/web Lit elements and registration | 71 catalog previews, browser/a11y/consumer tests | VERIFIED-BOUNDED |
| React integration | Provider/Region/hooks/SSR paths | packages/react wrappers over web/runtime | framework consumers, SSR/Next fixtures | VERIFIED-BOUNDED |
| Vue/custom-element integration | Preserve explicit tested adapter path | framework examples/consumer fixture | Named support profile only | VERIFIED-BOUNDED |
| Forms/inputs/navigation/feedback | Native semantics and explicit state | 15 input, 5 navigation, 9 feedback components | component family suites | VERIFIED-BOUNDED |
| Data/visualization/compound views | Table/list/card/chart/plot/trend and composed flows | 9 data, 12 visualization, 8 compound components | browser, semantic, SSR, consumer suites | VERIFIED-BOUNDED |
| Business actions | Preview/confirm/current authority/idempotency | runtime action ports and playground review | action/security suites; actual side effect host-owned | VERIFIED-BOUNDED |
| Non-data capability/job | Capability surface without fake relational data | feature/capability binding and vNext job fixture | synthetic job/editor tests | VERIFIED-BOUNDED |
| Agent context/render/act | Three registered tools through same runtime | app endpoint and capability registry | agent dispatch, UI, WebMCP simulation | VERIFIED-BOUNDED |
| MCP | stdio/HTTP server adapter with auth/origin guards | official SDK adapter and host gate | MCP protocol/consumer tests; live client unknown | VERIFIED-BOUNDED |
| WebMCP simulated | Fallback contract can be tested | injected modelContext adapter | 3 standard tools, render/detail/trend browser test | VERIFIED-BOUNDED |
| Native WebMCP | Native browser qualification | detection/adapter exists | no native headed qualification in this audit | UNKNOWN |
| Provider-agnostic model port | Host-supplied model loop bounded | model loop/OpenAI-compatible adapter | protocol-model tests; live quality absent | VERIFIED-BOUNDED |
| DeepSeek direct BYOK demo | Explicit opt-in direct browser provider path | site controls/model/agent | intercepted synthetic provider; no live call | IMPLEMENTED / PARTIAL |
| No-AI operation | Product useful without AI/account/provider | playground/manual app facade | browser proves 0 model calls and renderer-ready | OBSERVED |
| Static/SSR/islands | Existing web embedding paths | SSR, Next, vNext islands fixtures | named fixtures and JS-disabled DOM assertions | VERIFIED-BOUNDED |
| Public docs/catalog | Every active catalog ID has authored page/example | 71 catalog pages + generators | docs artifact/catalog checks | VERIFIED-BOUNDED, with DOC-01/02 |
| Production backend | Real app owns remote auth/data/actions | host adapter contracts | no product backend in repository | UNKNOWN |
| Production scale/latency | Bounded workload qualification | perf suites and support matrix | synthetic workload only | VERIFIED-BOUNDED; production UNKNOWN |
| npm/image/deployed site | Candidate release and runtime smoke | release tooling exists | not published/deployed in audit | BLOCKED |

## 6. Page, menu, dan UI inventory

### 6.1 Public site routes

The site generator builds the landing page, docs shell, search, 404, playground,
and authored pages. The authored page inventory is 50 pages in eight sections;
component inventory is separate.

| Area/menu | Current routes or surfaces | Observed/findings |
|---|---|---|
| Landing | / | Product promise, live synthetic People demo, four scenario/value blocks, authority boundary, consent-gated analytics. |
| Start | /start/, /start/what-is-aeliqo/, /start/standalone-components/, /start/existing-app/, /start/frameworks/ | Explains no-AI path, adoption, framework boundary. |
| Understand | /concepts/, /concepts/intent/, /concepts/semantics/, /concepts/state-ownership/, /concepts/safety/ | Defines Catalog → Intent → Task → Result → Recipe/Experience → Region. |
| Build/guides | data, local/HTTP data, permissions, adaptive Region, forms, navigation, actions, custom views, responsive | Host-owned I/O/authority/action boundary is explicit. |
| Reference | app API, packages, intent schema, diagnostics, resources | APIs and lifecycle; app-api has version-copy drift. |
| Connect agents | /agents/, quickstart, MCP, WebMCP, BYOK, recovery | Three tools and limits; WebMCP native explicitly unverified. |
| Examples | people, products, support, knowledge, index | Four reference journeys use synthetic fixtures. |
| Ship/legal | support matrix, browser support, SSR, release notes, migrations, privacy, license, security, support | Candidate/stable distinction is present; component Version blocks drift. |
| Playground | /playground/ | Manual structured intents default; local agent, simulated/native WebMCP detection, direct DeepSeek opt-in, inspector, export. |

### 6.2 Component catalog

catalog/components.json memuat 71 active IDs:

| Family | Count |
|---|---:|
| foundation | 13 |
| input | 15 |
| navigation | 5 |
| feedback | 9 |
| data | 9 |
| visualization | 12 |
| compound | 8 |
| **Total** | **71** |

Setiap catalog component memiliki authored page dan runnable preview menurut
inventory/artifact checks. Browser coverage me-mount component sebenarnya,
memeriksa Expected result, source example, no page error, dan JS-disabled docs
content untuk route docs. [E10] [E14]

### 6.3 UI state dan interaction inventory

State yang terlihat dalam contracts/runtime/UI: idle, loading, refreshing,
partial, ready, stale, denied, unsupported, failed, cancelled, disposed,
needs-input, proposed, renderer-ready, plan-committed, dan no-commit.

Evidence browser menunjukkan:

- playground manual mulai renderer-ready, menampilkan synthetic People dan
  detail tanpa model call;
- filter People mengubah exact Result;
- trend memakai meaning/time grain terdaftar dan tidak mengklaim penjumlahan
  snapshot;
- theme system/light/dark, responsive width 360/320/1440, skip-link/focus,
  dialog Escape, forced colors, dan axe scan diuji;
- route catalog, search, 404, JS-disabled docs content, export archive, dan
  no-default-egress diuji;
- DeepSeek key memerlukan consent, input dibersihkan setelah connect,
  request dibatasi, disconnect/reset/pagehide membatalkan dan menghapus key.

Temuan UX yang perlu ditindaklanjuti bukan implementasi source pada audit ini:
candidate/stable/version note terpecah antara root docs, site shell, dan
component pages. Pengguna teknis juga belum mendapat bukti live provider atau
production backend dari playground; disclosure sudah ada, tetapi claim tetap
harus dibatasi.

## 7. User journeys dan diagram runtime

### 7.1 Journey A — manual no-AI: People browse/filter/detail

~~~mermaid
flowchart LR
  A[Host define resource + identity] --> B[Create runtime + trusted authority]
  B --> C[Mount Region with DataService]
  C --> D[User control sends structured Intent]
  D --> E[Core parse + compile Task/query]
  E --> F[Authority read before evaluation]
  F --> G[Bounded DataService/evaluator]
  G --> H[ResultStore with scope/source/catalog pins]
  H --> I[Registered presentation resolver]
  I --> J[Region commit + renderer receipt]
  J --> K[Table/card/detail]
  K --> L[Resize/focus-aware adaptation]
~~~

Status: OBSERVED pada public playground dan browser suite; data yang dipakai
synthetic, bukan data pelanggan. [E09] [E14]

### 7.2 Journey B — remote data

~~~mermaid
sequenceDiagram
  participant UI as Browser Region
  participant RT as Aeliqo runtime
  participant DS as Host DataService
  participant S as Application server
  participant DB as Host data system
  UI->>RT: structured intent
  RT->>DS: bounded plan + scope/policy context
  DS->>S: application-owned request
  S->>DB: authorize + execute host query
  DB-->>S: bounded response/revision
  S-->>DS: validated protocol response
  DS-->>RT: Result events
  RT-->>UI: registered presentation / receipt
~~~

Status: protocol/source fixture VERIFIED-BOUNDED; S dan DB production tidak ada
di repository audit. Aeliqo tidak menggantikan server authorization.

### 7.3 Journey C — scoped surface dan stale fence

~~~mermaid
stateDiagram-v2
  [*] --> ActiveA
  ActiveA --> PendingB: requestChange(B)
  PendingB --> ActiveA: guard cancel/fail/old authority invalid
  PendingB --> ActiveB: recheck + authorize + fence A
  ActiveA --> Denied: forced revocation/logout
  ActiveB --> ActiveA2: A-B-A, new activationEpoch
  ActiveA --> Stale: late read/renderer/proposal
  ActiveA2 --> Stale: old A1 callback
  Denied --> [*]: old content masked/disposed
~~~

Immutable surface address mencakup runtimeId, scopeInstanceId, activationEpoch,
surfaceId, dan surfaceGeneration; callback lama tidak boleh retarget activation
baru. [E03] [E06]

### 7.4 Journey D — optional agent

~~~mermaid
sequenceDiagram
  participant M as Model/client
  participant EP as Paired endpoint
  participant AUTH as Host authority
  participant RT as Same runtime
  participant R as Region
  M->>EP: aeliqo_context
  EP->>AUTH: fresh principal/scope/grants
  AUTH-->>EP: allowed metadata
  EP-->>M: registered tools only
  M->>EP: aeliqo_render(intent)
  EP->>RT: parse/validate/evaluate/present
  RT->>R: commit or explicit failure receipt
  R-->>EP: renderer-ready/denied/stale
  EP-->>M: receipt; no claim without receipt
~~~

Action memakai preview → host confirmation → execute. Model tidak dapat
mengkonfirmasi dirinya sendiri. Live provider quality tetap UNKNOWN.

### 7.5 Journey E — error and continuity

~~~mermaid
flowchart TD
  Q[New request] --> W[loading]
  W --> R[read/evaluate]
  R -->|cancel/newer request| C[cancelled; preserve prior valid state]
  R -->|authority/scope/source changed| S[stale or denied; fence/mask]
  R -->|unsupported/ambiguous| N[needs-input or unsupported]
  R -->|valid| P[prepare presentation]
  P -->|renderer-ready/committed| V[replace current UI]
  P -->|failure while authorized| F[retain previous UI where contract permits]
  P -->|revocation| X[clear old authorized content]
~~~

## 8. Engine dan business logic

### 8.1 Core contract

defineDataFeature menurunkan metadata melalui defineResource, memvalidasi bounded
ID/revision, schema, identity, presentation, dan mem-freeze metadata. Non-data
feature memvalidasi capability/view/intent references, schema runtime,
uniqueness, dan unknown-field rejection. [E05]

Intent compiler:

- memeriksa field terhadap resource catalog dan menambahkan identity bila
  diperlukan;
- menolak identity yang tidak lengkap/berlebih;
- memeriksa filter field dan closed-domain value;
- menyusun standard browse/detail/compare/analyze/create/edit menjadi Task;
- mengunci catalogRevision, functionRegistryDigest, regionId, operation,
  output, dan preferred view;
- membutuhkan meaning/time grain terdaftar untuk analytical intent;
- memperlakukan custom capability dan view sebagai reference yang sudah
  terdaftar, bukan input agent bebas.

Ini adalah business logic koordinasi, bukan business policy. Pricing, membership,
server authorization, workflow effect, dan route tetap milik host.

### 8.2 Query dan semantics

Query contract menyimpan field, measure, relation, groupBy, population, order,
limit/budget, source/scope/policy/catalog/function pins, completeness,
precision, unknown, dan revision. Evaluator memeriksa authority/catalog/source
shape sebelum materialisasi. Result tidak boleh terlihat plausible bila
coverage atau meaning tidak cukup.

Batas yang terbukti adalah bounded query/fixture. Tidak ada bukti bahwa evaluator
ini dapat menggantikan database optimizer atau menjamin throughput untuk
production-scale arbitrary source.

### 8.3 Runtime, authority, Results

Runtime:

1. Host mendaftarkan resource, DataService/capability source, authority, renderer
   dan optional action port.
2. mount mengikat resource ke Region.
3. render membaca authority untuk context/evaluation/commit; compile dan
   evaluasi berjalan dalam boundary.
4. ResultStore memegang descriptor/batch/diagnostics dengan bounded entry,
   bytes, TTL, supersede, retain/release, revoke, dispose.
5. Commit melakukan recheck principal/scope/policy/revision sebelum UI baru
   dipublikasi.

Result cache key memasukkan principal opaque, scope digest, policy revision,
query/catalog/function/source revision, plan/result shape/lineage bila ada,
output dan task. principalKey tidak diletakkan di wire contract. Ini
mengurangi risiko cross-principal cache reuse, tetapi tetap membutuhkan host
authority dan source adapter yang benar.

### 8.4 Presentation/adaptation

Presentation resolver memilih hanya manifest/renderer yang registered dan
eligible untuk context, environment, target, accessibility, transition policy,
dan state. Region adaptation mengamati ukuran/pointer/hover/keyboard/reduced
motion/forced colors; hysteresis/dwell dan interaction guard mencegah layout
switch saat user sedang edit, IME composition, atau pointer gesture.

Previous presentation dapat dipertahankan saat adaptasi gagal jika scope masih
authorized; revoke/dispose membersihkan renderer dan menutup queue. Ini bukan
jaminan bahwa semua custom renderer pihak ketiga memiliki behavior yang sama.

### 8.5 Actions

Action source adalah host binding. Runtime/agent dapat membuat preview/proposal,
meminta current authority, dan mengecek idempotency/correlation/expected
revision. Actual write/side effect tidak dibangun oleh Aeliqo dan tidak
diotorisasi oleh renderer receipt. Test memakai synthetic host action; tidak ada
production effect yang dieksekusi selama audit.

### 8.6 Agent boundary

Endpoint memiliki explicit target Region, goal epoch, principal, lease expiry,
pending/time/byte budget, tool registry, schema local-reference check, dan
fresh authority read. Capability registry hanya menerima handler yang telah
terdaftar; model tidak dapat memasang handler atau menambah grant. MCP HTTP
menambahkan auth expiry/audience/issuer/host/origin checks. WebMCP adapter
membedakan evidence simulated dan native.

Batas penting: schema-valid tidak sama dengan semantically correct; model dapat
salah memahami bahasa. Sistem hanya menjamin reject/diagnostic/no-commit untuk
resource/field/meaning/view/action/permission/stale/budget yang tidak valid.

## 9. Architecture dan code quality

### 9.1 Dependency and ownership

| Layer | Tanggung jawab | Allowed dependency |
|---|---|---|
| core | contracts, schema, intent, semantics, query, presentation types | framework-independent |
| runtime | data/evaluation/authority/results/regions/actions/state | core; no DOM |
| web | Lit elements, browser registration, renderer, app facade | core, runtime, Lit |
| react | React provider/hooks/wrappers/SSR | core, runtime, web, React peer |
| agent | bounded proposals, MCP/WebMCP/model adapters | core, runtime; no grant authority |
| apps/site | public shell/docs/playground/local runner | consumes public packages |

Package docs dan boundary tests menyatakan dependency direction
core → runtime → web → react; agent tidak dibalikkan ke runtime. [E02] [E10]

### 9.2 Observed strengths

- Source-of-truth ownership jelas: host memegang identity, permissions, data,
  routes, business effects.
- Pure/core/runtime boundary terjaga secara package-boundary tests.
- Composition roots ada di runtime/web/site/runner, bukan pada core.
- Explicit versioned exports dan clean tarball consumer tests mengurangi
  “works only in monorepo”.
- Failure states berbentuk typed Outcome/diagnostics; catch boundary tidak
  mengubah failure menjadi success.

### 9.3 Maintainability observations

Project guide membatasi handwritten production file sampai 500 baris dan
function sampai 80 baris. Inventory menemukan beberapa file production di atas
500 baris:

| File | Baris |
|---|---:|
| packages/web/src/elements/aeliqo-table.ts | 539 |
| packages/agent/src/loop.ts | 529 |
| packages/runtime/src/presentation/adaptation-controller.ts | 525 |
| packages/web/src/region/input-binding-validation.ts | 524 |
| packages/runtime/src/actions/boundary-execution.ts | 518 |
| packages/web/src/region/aeliqo-region.ts | 514 |
| packages/web/src/compound/elements-inputs.ts | 509 |
| packages/web/src/region/navigation-feedback-config-navigation.ts | 507 |
| packages/runtime/src/app/runtime-controller.ts | 506 |
| apps/site/runner/server.mjs | 502 |

Ini bukan bukti bug runtime, tetapi merupakan deviasi maintainability yang
berpotensi menaikkan biaya review/perubahan di area paling sensitif. Tidak ada
decomposition/refactor dilakukan karena scope audit melarang perubahan source.

## 10. Data, API, state, dan lifecycle

### 10.1 Model data

Model utama:

Resource/Feature → Catalog/Meaning → Intent → Task/Query → Result/ResultEvent →
PresentationPlan/Recipe → Region/Surface snapshot → Receipt.

State live memisahkan:

- immutable feature definition;
- runtime/scope activation dan authority snapshot;
- surface address/intent/phase/revision/state;
- Result handles dan semantic cache pins;
- proposal/action preview/confirmation;
- renderer presentation/interactions;
- agent pairing/lease/goal epoch.

Tidak ada built-in relational database, queue, global record cache, billing
ledger, atau tenancy authority.

### 10.2 Data adapters

| Adapter | Current state |
|---|---|
| Local snapshot | Bounded, authorized rows di browser/worker; synthetic fixture terbukti. |
| HTTP client/server | Typed metadata/query/result protocol, auth/context hook, limits, cancellation; server application tetap final. |
| Custom source | Interface tersedia untuk host mapping; semantics, pagination, errors, cursor, revision harus ditentukan host. |
| Persistence | Interfaces/host ports ada; no default sensitive-draft persistence. |
| Audit export | Fixed bounded event shapes, docs melarang record payload/prompt/credential/direct identity. |

### 10.3 Lifecycle

create runtime → create/activate scope → register feature/surface → mount →
render/request → prepare Result/presentation → commit → observe/subscribe →
adapt/update → revoke/fence/cancel → unmount/dispose.

Newer request supersedes pending read in a surface. Scope activation uses
monotonic epoch and immutable address. Result handles have bounded TTL and
retain/release semantics. On forced revocation, old UI is masked/cleared and
late work becomes stale/denied; voluntary guard may retain authorized old
surface until decision.

### 10.4 Public API map

| Package | Root and representative subpaths |
|---|---|
| @aeliqo/core | root, schema, contracts, app, features, expressions, semantics, query, interaction, presentation, plot, visualization, agent |
| @aeliqo/runtime | root, app, evaluation, data, results, regions, persistence, actions, audit, interaction, presentation, meaning, surfaces, scopes |
| @aeliqo/web | root, app, recipes, register, server, foundation, inputs, navigation, feedback, data, visualization, plot, region, compound |
| @aeliqo/react | root, app/surface, foundation, inputs, navigation, feedback, data, SSR, plot, visualization, compound |
| @aeliqo/agent | root, app, browser, capabilities, session, meaning, protocol, model, MCP, WebMCP |

Export maps and installed/clean consumer checks are part of the quality matrix.

## 11. Integrations, configuration, dan runtime environment

### 11.1 Host integration requirements

An application must supply, as relevant:

1. resource/schema/identity/meaning/view definitions;
2. local DataService or HTTP/custom adapter;
3. current trusted authority (principalKey, scope, policy, grants, revisions);
4. renderer/element registration or React integration;
5. route/navigation/form state ownership;
6. action source and server-side authorization for writes;
7. optional scoped agent transport/client/model;
8. lifecycle/disposal integration with application/session.

Selector workspace/tenant/project bukan permission. Server harus resolve selector
terhadap authenticated identity pada setiap operation yang relevan.

### 11.2 Local runner

apps/site/runner/server.mjs adalah development/local playground server:

- bind 127.0.0.1, default port 4174;
- local MCP token random bila env tidak diberikan, timing-safe compare;
- session cookie HttpOnly, SameSite=Strict, 15-minute lifetime;
- host/origin allowlist dan request byte limits;
- optional server model hanya bila AELIQO_MODEL_API_KEY,
  AELIQO_MODEL, AELIQO_MODEL_BASE_URL dikonfigurasi bersama;
- remote model endpoint wajib HTTPS kecuali explicit loopback HTTP opt-in;
- no model configuration means manual/no-AI remains usable.

Ini bukan production ingress, identity provider, reverse proxy, or multi-user
session service. [E09]

### 11.3 Tested support profile

Docs support matrix membatasi claim pada:

- Vanilla DOM, Lit 3.3.3, React 19.2.8, Vue 3.5.42, Next 16.3.4;
- Chromium, Firefox, WebKit via Playwright 1.63.0;
- no-AI dan local synthetic protocol fixture;
- empat reference journeys, paged synthetic data, 1.000 declared modules /
  lima active surfaces.

Native WebMCP, live model latency/quality, hosted providers lain, production
database throughput, dan unlimited application size dinyatakan unverified atau
unsupported claim. [E10]

## 12. Security, privacy, performance, dan reliability

### 12.1 Security/trust controls yang teramati

- unknown agent fields, wire value, schema references, tool names, capability
  refs, input/output bytes, pending calls, lease, dan time budget dibatasi;
- agent hanya memilih registered capability; tidak memasang handler, grant,
  HTML, JavaScript, SQL, module URL, atau arbitrary renderer;
- authority dibaca fresh sebelum context/evaluation/commit/action; commit
  membandingkan principal/scope/policy/revision;
- Result cache key dipartisi principal/scope/policy/source/plan/lineage;
- scope/surface address dan activation epoch mencegah late A-B-A callback;
- MCP HTTP memeriksa host/origin/auth expiry/audience/issuer;
- SSR/static route dan URL/text boundaries diuji;
- revoke/dispose membatalkan pending work, fences target, dan clear/mask
  unauthorized content;
- direct BYOK memakai explicit consent, password input, credentials omit,
  cache no-store, redirect error, no-referrer, bounded request/response,
  timeout, clear-on-disconnect/pagehide;
- no-AI browser tests membuktikan tidak ada model request pada manual path.

Security suite pass berarti kontrol yang diuji bekerja pada fixture, bukan
jaminan bebas vulnerability. Host server authorization dan provider retention
tetap di luar library control.

### 12.2 Privacy and data egress

Tidak ada credential/data pelanggan yang dipakai audit. Public site tidak
melakukan default provider/analytics egress dalam browser suite; analytics
consent ditampilkan dan diuji. BYOK adalah exception eksplisit: user memilih
DeepSeek dan payload scenario/prompt dikirim langsung ke endpoint provider.
Provider retention/processing policy tidak diverifikasi dalam audit. Ini adalah
disclosure/operational risk yang perlu tetap jelas untuk user.

### 12.3 Performance and reliability

Observed controls:

- byte/row/column/request/materialization/entry/TTL/pending/time budgets;
- cancellation and late-result guards;
- retry policy and bounded model loops;
- visual suites Chromium/Firefox/WebKit;
- vNext workload/performance/bundle and heap/adverse tests wired into scripts;
- support profile membatasi 1.000 declared modules/5 active surfaces.

Tidak ada klaim p95, throughput, memory, cold start, atau cost untuk device,
database, network, provider, atau traffic produksi yang tidak diuji.

### 12.4 Risk classification

| Risk | Current assessment |
|---|---|
| Agent bypasses registered capability | Mitigated in tested path; no confirmed issue. |
| Cross-principal Result/cache leakage | Strong pins/revocation/tests; actual host/source implementation remains prerequisite. |
| Browser check mistaken for server auth | Explicitly documented as host responsibility; integration risk, not confirmed defect. |
| BYOK credential exposure | Key is cleared/not persisted in tested path; direct provider egress and provider retention remain user-visible risk. |
| Native WebMCP mismatch | Unknown until native headed probe; manual fallback remains tested. |
| Stale scope/late response | Address/epoch/fence tests exist; production host transition integration unverified. |
| Performance collapse at production scale | Unknown beyond bounded synthetic profile. |

## 13. Tests dan verification

### 13.1 Fresh acceptance run

Command yang dijalankan dari source SHA audit:

~~~text
pnpm check
~~~

pnpm check adalah python3 scripts/quality.py dan memuat 87 command:
typecheck, unit/semantic/query/runtime suites, browser suites, clean tarball
consumers, security/boundary/auth-retention, a11y, docs/catalog, visual
Chromium/Firefox/WebKit, agent evaluation UI, vNext browser/performance,
docs inventory, dan release tooling.

Hasil fresh run: **87/87 command lulus, exit code 0**, tanpa failure. Artifact
fresh menulis sourceRevision yang sama dengan SHA audit
04937d21df75cfb32a891d4f52de9da5a6a7e678, status passed, dan 87 result. Visual
Chromium/Firefox/WebKit, agent evaluation UI, vNext browser/performance, docs
inventory, dan release tooling semuanya lulus. Bukti machine-readable:
artifacts/product-ci/ci.json dan log paths di bawah artifacts/product-ci/logs/.
Artifact/screenshots tidak dijadikan source change.

Sebagai pemeriksaan read-only terpisah, pnpm release:registry-check juga exit 0:
registry npm menyatakan @aeliqo/core, runtime, web, react, dan agent versi 0.5.0
available untuk publication. Ini berarti version tersebut belum dipublish; command
tidak melakukan publish atau perubahan registry. [E15]

### 13.2 Coverage yang dijalankan/direview

| Verification family | Bukti yang dicari |
|---|---|
| Core/contracts/semantics/query | schema rejection, identity/filter/domain, meaning/grain/precision, plan pins |
| Runtime/data/results/regions/actions | local/HTTP protocol, cancellation, stale, revocation, TTL/byte/entry, preview/confirm |
| Web/components/adaptation | native semantics, keyboard/focus, responsive, visual states, candidate eligibility |
| React/framework/SSR | React/Vue/Next/static-island named consumer paths |
| Agent/protocol | endpoint lease/budget/target, model loop, MCP, WebMCP simulation, no forged receipt |
| Security | package boundaries, action replay, revocation/materialization, auth retention, adversarial inputs |
| Consumers | clean installed tarballs for packages/families/frameworks |
| Site/docs | all 71 catalog pages/examples, search/404/JS disabled, playground and legal/support pages |
| Performance | bundle, vNext workload, bounded active surfaces, adverse/lifecycle suites |

### 13.3 Verification yang tidak dilakukan

- tidak ada npm publish, npm install dari registry candidate, GitHub release,
  image publish, deployment, /healthz,/readyz,/version production smoke;
- tidak ada live DeepSeek/OpenAI/hosted provider call, paid evaluation, atau
  provider retention review;
- tidak ada native WebMCP headed probe;
- tidak ada real customer/backend/tenant/database/queue integration;
- tidak ada usability study, host-only baseline comparison, PMF, revenue,
  conversion, retention, atau unit economics;
- tidak ada full dependency vulnerability scan/third-party security
  certification sebagai bagian audit ini;
- tidak ada manual assistive-technology certification di luar automated axe dan
  keyboard/browser tests.

## 14. Monetization, cost, dan commercial reality

Aeliqo diposisikan sebagai open-source Apache-2.0 framework. vNext spec secara
eksplisit menolak hosted cloud, billing, SSO/SCIM, marketplace, dan proprietary
infrastructure sebagai requirement. Tidak ada subscription, account, atau
license network service yang diperlukan untuk jalur manual.

Cost yang tetap ada pada adopter:

- engineering integration dan host adapter maintenance;
- browser/server/database/observability infrastructure milik adopter;
- optional model/provider usage dan egress bila agent/BYOK diaktifkan;
- operational work untuk server authorization, business actions, deployment,
  rollback, dan compliance.

Audit tidak melakukan paid call dan tidak memiliki data untuk menilai willingness
to pay, TCO dibanding host-only UI, atau savings per journey. Technical
capability bukan bukti commercial viability.

## 15. Documentation, legacy, dan unfinished work

### 15.1 Current documentation

- docs/site/ adalah authored public docs dan component pages.
- docs/packages/ adalah canonical package guides; release staging menghasilkan
  package README.
- catalog/components.json adalah active component source.
- examples/catalog dan examples/vnext/reference/quickstart/vertical-slice
  menjadi runnable source.
- scripts/docs/build-public-docs.mjs dan apps/site/generate-pages.mjs
  menggenerate public pages; artifacts/dist tidak boleh diedit sebagai source.

### 15.2 Historical/legacy material

Migration pages, ADRs, 0.3/0.4 implementation records, dan vNext planning
pack dipertahankan sebagai history/reference. Mereka bukan active release
contract kecuali ditautkan ke current source/export/test evidence. Repository
release policy memang meminta historical ADR dan npm artifacts tetap tersedia.

### 15.3 Incomplete or release-gated items

| Item | Status |
|---|---|
| 0.5.0 registry availability | Belum dibuktikan/published; blocker |
| Public component version prose | 71 pages stale pada 0.4.2; confirmed docs finding |
| Native WebMCP | Adapter ready, qualification unknown |
| Live provider quality/cost | Unknown; synthetic compatibility only |
| Production backend/identity/actions | Host integration required; unknown |
| Production image/deployment/runtime smoke | Not performed; blocker for production claim |
| Human value/usability evidence | Not present |
| Independent pre-merge review of this audit | Tidak dilakukan dalam task ini |

## 16. Findings dan risk register

Prioritas: P0 release/claim blocker, P1 material product/integration risk,
P2 correctness/documentation/maintainability follow-up. Confidence hanya
menilai kualitas evidence, bukan severity.

| ID | Prioritas | Finding | Impact | Confidence | Recommended next evidence |
|---|---|---|---|---|---|
| REL-01 | P0 | Local five-package line is 0.5.0 candidate; root/site docs state stable 0.4.2; read-only npm preflight confirms 0.5.0 is available, not published. | External adopter cannot safely install candidate; release contract incomplete. | High | Owner-authorized RC/stable publication, clean registry consumer, exact source commit, and release record. |
| EVID-01 | P0 for production claim | No production backend, deployed image, runtime smoke, live provider, or native WebMCP evidence. | Must not claim production/provider/native support beyond named fixture profile. | High | Run separately authorized production/registry/provider/native gates; record environment and artifacts. |
| DOC-01 | P1 | 71 component Version sections say Aeliqo 0.4.2 while generated candidate shell says 0.5.0. | Public docs can give contradictory installation/version guidance. | High | Synchronize authored version notes or clearly mark historical compatibility; add stale-version check. |
| DOC-02 | P2 | Application API page description says Aeliqo 0.4. | Search/reference copy is stale in candidate docs. | High | Update after release decision and rerun docs artifact. |
| SITE-01 | P2 | Site private package version is 0.4.2 while workspace packages are 0.5.0. | Release dashboards may misread site build version. | Medium | Decide whether site version is intentionally independent; expose both site/source/package versions in release report. |
| SEC-01 | P1 integration risk | Library/browser checks cannot guarantee server authorization or provider retention. | A host can still misconfigure backend or external provider; browser success is not authority. | High | Require real host auth/action integration review, data-flow/retention review, and server smoke before claim. |
| BYOK-01 | P1 disclosure/quality | Playground direct adapter hardcodes DeepSeek endpoint/model and sends opted-in prompt/scenario to provider. | Provider-agnostic core does not mean provider-neutral live demo; live semantics/cost/retention unknown. | High | Keep disclosure; evaluate approved providers separately and record data handling/cost/quality. |
| MAINT-01 | P2 | Several handwritten production files exceed 500-line project guideline. | Review and change risk in runtime/agent/web boundary code. | High | Targeted decomposition review with focused tests; no broad rewrite implied. |
| VALUE-01 | P1 product unknown | Technical fixtures show mechanics but no host-only comparison, developer usability study, PMF, or ROI. | Cannot assert that integration cost is reduced for target teams. | High | Run four host-only baselines and structured usability tasks; report participants/limitations honestly. |

None of these findings was fixed during audit; this report is evidence and
decision input only.

## 17. Recommendations dan release blockers

### Release blockers for a public 0.5.0

1. Keep the candidate label until all five exact package versions are actually
   published and clean registry consumers install the same source release.
2. Resolve DOC-01 and DOC-02, then rerun docs artifact, catalog examples,
   inventory, and source/version consistency checks.
3. Complete independent review and the owner-authorized RC → stable workflow;
   do not infer publish/deploy authority from repository write access.
4. Build/deploy the immutable site image from the verified source revision,
   retain rollback image, and execute health/readiness/version/route/search/
   playground/package-install smoke checks.
5. Keep live provider quality, native WebMCP, production backend/scale, and
   human value results as separate qualification rows; do not convert
   synthetic/mock/simulated results into universal support.

### Recommended product validation

- Compare the four reference journeys against a minimal host-only baseline and
  count duplicated state/wiring/debugging work.
- Test developers who did not implement the fixture: intent authoring,
  authority wiring, recovery, responsive transitions, and action confirmation.
- Observe real backend pagination/coverage/semantic failure cases without
  sending customer data to a model.
- Run provider/native WebMCP profiles only with explicit authorization, budget,
  browser version, and retention disclosure.

## 18. Unknowns, blockers, dan remaining work

| Unknown/blocker | Why unknown | Claim blocked | Owner/evidence needed |
|---|---|---|---|
| 0.5.0 exact package publication | Read-only preflight says all five versions are available, but no publish was performed | “Install candidate from npm” | Release owner + trusted publication + clean registry consumer |
| Site image deployed and healthy | No deployment/system access in scope | “Production site is live” | Platform owner + immutable image smoke |
| Real remote backend auth and tenant isolation | No customer backend | “Production data is secure through Aeliqo” | Integrating app security review |
| Live model quality and cost | No credentials/paid call | “Agent understands requests reliably/cheaply” | Approved provider evaluation ledger |
| Native WebMCP | Simulated host only | “Native browser supports WebMCP” | Headed native probe with exact browser/flags |
| Scale on real hardware/network/data | Synthetic bounded profile only | “Supports production scale/p95” | Reproducible workload on target profile |
| Human usability/ROI/PMF | No users or host-only comparison | “Aeliqo reduces engineering cost” | Product research and baseline evidence |
| Manual AT certification | Automated axe/keyboard only | “WCAG/AT universal compliance” | Human assistive technology review |
| Dependency vulnerability posture | No separate audit in this task | “No dependency CVEs” | Security/dependency scan |

## 19. Evidence index dan coverage ledger

### 19.1 Evidence index

| ID | Evidence | What it proves | What it does not prove |
|---|---|---|---|
| E01 | git rev-parse, git status, git remote -v, package manifests, release-metadata.json | Exact checkout, versions, branch, public package set | Publication/deployment |
| E02 | README.md, docs/site/pages/what-is.md, docs/site/pages/packages.md | Product promise, ownership, boundaries, stable/candidate disclosure | PMF or production behavior |
| E03 | docs/plans/aeliqo-vnext/01-SPEC.md, 03-ACCEPTANCE.md, 02-EXECPLAN.md | Intended contract and explicit evidence limits | Current runtime by itself |
| E04 | Source/test/docs inventory commands recorded in §1.2 | Scope and review depth | Semantic review of every file |
| E05 | packages/core/src/features, app/resource.ts, app/intent.ts, query, semantics | Core validation/compiler/query behavior | Arbitrary host data correctness |
| E06 | packages/runtime/src/app, surfaces, scopes, results, presentation | Authority, lifecycle, scope fence, Result/presentation mechanics | Production identity/backend |
| E07 | packages/web/src/app, region, component families; packages/react/src | Browser renderer, adaptation, framework bindings | All consumer application patterns |
| E08 | packages/agent/src/app, protocol, capabilities, model, mcp, webmcp | Bounded agent/protocol/model controls | Live provider/native client |
| E09 | apps/site/src/playground, deepseek files, apps/site/runner/server.mjs, site browser/BYOK specs | Manual playground, BYOK controls, local runner security profile | Deployed site/provider retention |
| E10 | catalog/components.json, docs/site/components, support/browser/security docs | 71 component surface and documented qualification boundaries | Human AT certification |
| E11 | quality/commands.json | 87-command acceptance matrix | A pass before fresh run |
| E12 | docs/plans/aeliqo-vnext/07-EXECUTION-STATE.md, VALIDATION-REPORT.md, existing artifacts | Historical/planning checkpoint context | Current pass unless SHA matches |
| E13 | tests/security, auth-retention probe, protocol tests | Adversarial/boundary test intent | Formal security certification |
| E14 | Fresh pnpm check, artifacts/product-ci/ci.json only after current source SHA | Current integrated verification | Production release/deploy |
| E15 | Read-only pnpm release:registry-check; npm registry JSON preflight | All five 0.5.0 package versions are available for future publication and not already published | Publication, provenance, consumer install, or deployment |

### 19.2 Source coverage ledger

| Area | Coverage state | Evidence | Unreviewed/limited area |
|---|---|---|---|
| Core contract/compiler/query | Deep critical-path review + suites | E05, E14 | Exhaustive schema/input combinations |
| Runtime authority/scope/surface/results | Deep critical-path review + suites | E06, E14 | Host adapter behavior |
| Web/adaptation/components | Core app/Region deep review + catalog/browser suites | E07, E10, E14 | Every component implementation line |
| React/framework/SSR | Exports and consumer paths + suites | E07, E14 | Arbitrary app integration |
| Agent/MCP/WebMCP/model | Endpoint/protocol deep review + suites | E08, E14 | Live clients/providers/native browser |
| Site/playground/runner | Deep relevant route and security review + browser suites | E09, E14 | Deployed infrastructure |
| Docs/catalog/examples | Inventory equality and representative prose review | E10, E14 | Human editorial review of every paragraph |
| Tests/quality | Matrix and fresh integrated run | E11, E14 | Tests cannot prove untested production environment |

### 19.3 vNext requirement ledger (RQ01–RQ46)

Status VERIFIED-BOUNDED means the current fresh suite/profile passed. PARTIAL
and UNKNOWN are deliberate; they prevent a test count from hiding missing
human, live, production, or release evidence.

| RQ | Outcome | Status | Evidence / boundary |
|---|---|---|---|
| RQ01 | Fresh checkout, policy, toolchain, catalog, baseline | VERIFIED-BOUNDED | E01, E04, E14; baseline is local |
| RQ02 | No-AI standalone/adaptive path | VERIFIED-BOUNDED | E09, E14; no-AI browser proof |
| RQ03 | Small typed public DX, no god config | VERIFIED-BOUNDED | E03, consumer/type suites; bounded fixtures |
| RQ04 | Immutable features and scoped bindings | VERIFIED-BOUNDED | E05, feature tests |
| RQ05 | Multiple independent instances | VERIFIED-BOUNDED | E06, vNext/surface isolation tests |
| RQ06 | Strict Mode/interrupted/unmount/disposal lifecycle | VERIFIED-BOUNDED | E06, React/browser/lifecycle suites |
| RQ07 | Controlled host state cannot be bypassed | VERIFIED-BOUNDED | surface proposal/action tests |
| RQ08 | Local updates retain identity and bounds | VERIFIED-BOUNDED | local data/runtime suites |
| RQ09 | Remote coverage/pagination/unsupported capability | VERIFIED-BOUNDED | HTTP protocol/data fixtures; no production source |
| RQ10 | Analytics grain/unit/ratio/time/partial safety | VERIFIED-BOUNDED | semantic/query fixtures |
| RQ11 | Deterministic resolver result/explanation | VERIFIED-BOUNDED | presentation/adaptation suites |
| RQ12 | Eligibility/pins/ambiguity/fallback explicit | VERIFIED-BOUNDED | resolver/presentation tests |
| RQ13 | Existing host UI/native React custom view | VERIFIED-BOUNDED | framework/React consumers; bounded fixtures |
| RQ14 | Writes preview/confirm/auth/idempotency | VERIFIED-BOUNDED | action/security synthetic host |
| RQ15 | Non-relational/editor/job capability | VERIFIED-BOUNDED | vNext/job examples; bounded |
| RQ16 | SSR meaningful content/hydration | VERIFIED-BOUNDED | SSR/Next/JS-disabled DOM tests |
| RQ17 | Framework/support matrix honestly qualified | VERIFIED-BOUNDED | support matrix + consumer suites |
| RQ18 | Accessible states/work preservation | VERIFIED-BOUNDED | browser/a11y/visual; human AT absent |
| RQ19 | Theme/locale/RTL/time/motion/zoom/expansion | PARTIAL | tested profiles cover some; no full manual/device qualification |
| RQ20 | Optional scoped/authenticated/cancellable agent | VERIFIED-BOUNDED | agent/session/protocol tests |
| RQ21 | BYOK protocol capability, not vendor lock | PARTIAL | core port is generic; playground demo is DeepSeek-specific |
| RQ22 | Live provider quality separated from mock compatibility | PARTIAL | synthetic quality boundary exists; live evaluation absent |
| RQ23 | Permission/egress/injection/forged receipt containment | VERIFIED-BOUNDED | security/agent/protocol suites |
| RQ24 | Accurate docs for every catalog component | PARTIAL | pages/examples/inventory pass; DOC-01 version prose drift |
| RQ25 | Copyable examples typecheck/run from consumers | VERIFIED-BOUNDED | catalog/docs/consumer suites |
| RQ26 | Value across distinct application classes | PARTIAL | four technical journeys; no host-only/usability evidence |
| RQ27 | Bundle/work/latency/memory/module budgets | VERIFIED-BOUNDED | bounded performance suites; production scale unknown |
| RQ28 | Scoped registries/lazy loading at large app profile | VERIFIED-BOUNDED | 1.000 module/5 active synthetic profile |
| RQ29 | Versioned API/protocol/migration/old consumers | VERIFIED-BOUNDED | exports/consumer/migration/release tests; registry candidate absent |
| RQ30 | Full quality matrix remains enforced | VERIFIED-BOUNDED | E11, fresh E14 |
| RQ31 | Authorized/recoverable publish/deploy | BLOCKED | E15 confirms version availability only; no trusted publication/image/deploy/runtime evidence |
| RQ32 | Checkpoints preserve decisions/failures/work | VERIFIED-BOUNDED | execution-state + this audit; historical state reconciled |
| RQ33 | No duplicate authority/query/business engine | VERIFIED-BOUNDED | dependency/boundary/parity suites |
| RQ34 | Rate/concurrency/cancel/retention/quotas bounded | VERIFIED-BOUNDED | protocol/runtime/security/perf suites |
| RQ35 | Receipts do not imply success without actual commit | VERIFIED-BOUNDED | agent/UI receipt and no-commit tests |
| RQ36 | No unlimited scale/framework/provider claim | VERIFIED-BOUNDED | support matrix explicitly bounded |
| RQ37 | Scope switching isolated/stale-safe/portable rules | VERIFIED-BOUNDED | scope/cache/action tests; real host unknown |
| RQ38 | Agent follows current trusted scope | VERIFIED-BOUNDED | scoped bridge/goal/target tests |
| RQ39 | Voluntary guards vs forced invalidation | VERIFIED-BOUNDED | scope/revocation/recovery tests |
| RQ40 | Old callbacks/A-B-A cannot retarget | VERIFIED-BOUNDED | epoch/address/generation race tests |
| RQ41 | Workspace layout coherent without tenancy change | VERIFIED-BOUNDED | composition/adaptation fixtures |
| RQ42 | Browser/server boundary resists leakage/CSRF/XSS/cache | VERIFIED-BOUNDED | security/browser/SSR tests; deployed server unknown |
| RQ43 | Cache identity separate from UI fencing | VERIFIED-BOUNDED | Result/scope/cache tests |
| RQ44 | Agent continuation isolated by scope/target | VERIFIED-BOUNDED | session/bridge/provider-payload tests; external backend history unknown |
| RQ45 | One API contract and non-vacuous consumers | VERIFIED-BOUNDED | current vNext consumers/browser/SSR tests |
| RQ46 | Handoff/migration/export/docs same version/requirements | PARTIAL | release metadata/exports align; DOC-01/02 and candidate publication remain |

### 19.4 Audit completion state

Audit documentation is complete after this file is committed. Product release
is **not** complete: REL-01, EVID-01, DOC-01, and the explicitly listed
unknowns remain. Fresh technical verification is complete; release and
production evidence remain separate gates. Commit/push status is intentionally
recorded in the final assistant response and Git history.

# AELIQO — Master Source of Truth

## Product target 0.1.0 | Specification edition 1.1 | 8 September 2026

**Status:** master desain, kontrak implementasi, dan harness/reference tests. Bukan SDK 0.1.0 yang sudah selesai, bukan certification, dan bukan bukti performa produksi. Laporan pengujian aktual berada di `VALIDATION.md`.

**Tujuan produk:** menjadikan data aplikasi dan kebutuhan pengguna sebagai dasar antarmuka yang dapat beradaptasi, interaktif, berkualitas visual tinggi, dan dapat dikendalikan manusia maupun agent. Aeliqo menyediakan komponen sendiri. Ia bukan sekadar pembungkus component library pelanggan, bukan hanya dashboard generator, dan bukan generator kode UI arbitrer.

**Prinsip AI:** model boleh salah; efeknya harus diperiksa terhadap kontrak sebelum diterima. Aeliqo tidak mengaku mengetahui seluruh maksud manusia atau kebenaran bisnis. Validasi yang berhasil tidak sama dengan interpretasi yang benar.

## 1. Otoritas dokumen dan cara membaca

Master ini adalah titik masuk dan otoritas keputusan produk/foundation. Bab bernomor dalam `docs/` merupakan spesifikasi rinci yang dirujuk master; `harness/` memetakan acceptance ke pekerjaan/evidence; `contracts/` berisi reference types dan probes, bukan package produksi. `AGENTS.md` mengarahkan pelaksanaan, bukan mengganti requirement.

Jika terdapat konflik, jangan memilih versi yang paling mudah diimplementasikan. Catat conflict, gunakan keputusan master yang lebih baru, perbaiki semua chapter/schema/task terkait, dan tambahkan regression sebelum melanjutkan. `docs/39-discussion-ledger.md` merekam koreksi diskusi. Kit/blueprint lama dan gambar generatif bukan instruction overlay. Tidak ada dua versi SoT aktif.

Dokumen master adalah rujukan keputusan dan ringkasan lengkap; detail executable tetap pada file yang ditunjuk. Agent membaca progresif: master, task terpilih, lalu chapter relevan. Jangan memasukkan seluruh ratusan halaman konteks ke setiap subagent. PDF/DOCX adalah salinan baca; perubahan dilakukan pada Markdown dan schema source, kemudian salinan dihasilkan ulang.

Ambisi menjadi produk berkualitas dunia diperlakukan sebagai target engineering dan adopsi, bukan klaim factual “nomor satu”. Setiap klaim shipped, supported, tested, accessible, fast, published, dan deployed membutuhkan evidence dengan batas yang dinyatakan. Tidak ada janji satu prompt menyelesaikan seluruh produk tanpa checkpoint atau review manusia.

## 2. Masalah yang diselesaikan

Developer biasanya membangun halaman, query, formatting, chart, tabel, detail, selection, form, dan agent bridge secara terpisah. Ketika pengguna meminta kombinasi baru, integrasi tersebut diulang. Aeliqo menyediakan kontrak bersama agar kebutuhan baru dapat dikomposisikan dari meaning dan kemampuan yang sudah tersedia.

Pengguna akhir cukup meminta: “Tampilkan karyawan”, “urutkan yang tingkat ketidakhadirannya paling tinggi”, “trend lima itu”, atau “buka record sumbernya”. Mereka tidak harus memilih chart atau menulis formula. Developer tetap menyediakan sumber dan aturan domain yang tidak bisa diketahui dari bentuk JSON. Aeliqo tidak menciptakan data yang tidak ada.

Produk dapat digunakan sebagai komponen biasa, semantic compound, atau region adaptif di aplikasi yang sudah berjalan. Area pencarian, detail produk, perbandingan, editor record, dan form termasuk scope; dashboard hanyalah satu bentuk pengalaman. App shell, autentikasi, backend, database, business workflow execution dan deployment aplikasi milik host tidak diambil alih.

Scope visual adalah primitive aplikasi dan 2D: native controls, typography, collection/detail, forms, layout, dan visualisasi. Tidak termasuk 3D, CAD, media editor, arbitrary website code generation, universal BI database, workflow programming language, atau seluruh native platform sekaligus.

## 3. Empat konsep publik

| Konsep | Isi penting | Tidak bertanggung jawab atas |
|---|---|---|
| Catalog | Shape, meaning, identity, grain, relasi, capabilities, versions dan authorized visibility | Memilih UI atau menjalankan endpoint arbitrer |
| Task | Goal, data outputs/dependencies, scope, kebutuhan operasi, interpretation assumptions dan batas presentasi | CSS, DOM, credentials, atau satu template wajib |
| Result | Data/handle, schema, scope, grain, precision, lineage, revision dan completeness | Mengarang business meaning atau menyimpan seluruh transcript |
| Experience | Desain Aeliqo, patterns, allowed composition, adaptation dan state-preservation policies | Menentukan rumus domain atau permission backend |

Catalog merupakan view terotorisasi, bukan satu blob yang selalu dikirim kepada model. Task dapat mengandung beberapa named outputs dengan grain berbeda. Result descriptor berbeda dari payload besar. Experience adalah aturan input; presentation plan adalah output internal compiler. Empat konsep ini tidak membatasi jumlah interface internal, tetapi membatasi kompleksitas yang harus dipahami consumer.

Internal AST/query/render plans harus bertipe, versioned dan inspectable. Ia tidak perlu menjadi tiga bahasa publik baru. Public ergonomic API boleh memakai factory/builder kecil yang compile ke representasi canonical. Satu schema source menghasilkan wire validation, TypeScript declarations, dokumentasi dan editor forms yang konsisten.

## 4. Flow end-to-end dan tiga loop

```text
USER / APPLICATION
  |-- explicit controls --------------------> interaction runtime
  |-- explicit structured task ------------> proposal boundary
  `-- natural language --> optional AI -----> proposal boundary
                                                |
                         bind + validate + permission + budget
                                                |
                          Task: named reads / reuse / form
                                                |
                              evaluate through data service
                                                |
                         Result: scope + grain + provenance
                                                |
                      inspect / refine (optional AI reasoning)
                                                |
                      present relevant results, not every query
                                                |
           Task + Result + Experience + Environment + current state
                                                |
                     feasible pattern-assisted UI composition
                                                |
                           recheck versions -> commit -> render
                                                |
              clicks / filters / ranges / drafts -> incremental loop
```

**Reasoning loop** mengerti bahasa, mencari konteks, mengusulkan task/meaning/query/view, meninjau hasil dan menentukan langkah berikutnya. **Compilation loop** memvalidasi dan menyusun rencana yang dapat dijalankan. **Interaction loop** memproses kontrol rutin dengan state dan query delta tanpa model call.

Jalur direct component tidak dipaksa melewati ketiga loop: value/records/props menuju behavior dan rendering. Jalur queryless form/presentation tidak membuat query palsu. AI boleh menjadi interface utama pengguna, tetapi native input/rendering tetap tidak bergantung pada latency model.

## 5. Boundary modul dan ownership

Core murni berisi contracts, semantic/expression validation, query planning, presentation candidate validation, dan diagnostics. Tidak mengimpor DOM, React, Lit, D3, provider SDK, MCP SDK, database driver, filesystem, atau clock/network global. Fakta waktu/lingkungan masuk melalui input eksplisit.

Runtime mengoordinasikan efek melalui data/action/renderer ports dan fungsi clock/scheduler/storage/telemetry. Web memiliki native controls, text measurement, overlay/focus, CSS layout dan geometry realization. React mengadaptasi property/event/lifecycle dari implementasi web yang sama. Agent memproyeksikan capability yang sama ke protokol atau model port. Devtools/Studio/testkit optional untuk penggunaan runtime.

| State | Owner |
|---|---|
| Records, principal, auth, routes, business action | Aplikasi/host |
| Catalog, metric/function definition dan profile | Registry versioned |
| Task, region revision, parameter dan commit | Runtime instance |
| Data batches, handles, leases dan source versions | Result store |
| Selection/navigation | Runtime/controller sesuai scope |
| Draft editing | Controller entity-field-domain revision |
| Hover/local open state | Komponen |
| Transcript reasoning | Agent host, bukan core |

Tidak ada global mutable singleton per pengguna. SSR memakai state isolasi per request. Registry statis hanya dapat dibagi jika tidak memuat tenant/user secrets. Simpan ownership dan lifecycle, bukan kebiasaan global context tersembunyi.

## 6. Data: agnostic tanpa daftar vendor connector

Application Data Contract adalah satu kontrak Aeliqo, bukan klaim standar industri. Tiga operasi konseptual: `describe`, `plan`, `execute`. Local in-process dan HTTP menggunakan semantics yang sama, tetapi bukan asumsi latency/failure yang sama. Source menjelaskan predicate/grouping/order/pagination/function/relasi/consistency yang didukung. Kemampuan global `joins: true` terlalu lemah; relasi dan grain harus spesifik.

Aeliqo menyediakan bounded local evaluator, generic HTTP transport/reference host, schema-authoring helpers dan conformance suite. Consumer data kecil cukup menyediakan records dan identity. API koleksi menyediakan reader dan paging/filter capability. Backend analitik menyediakan execution atas kemampuan yang nyata, memakai query service/database library yang sudah dimiliki. Opaque named metric sah jika input/output/grain/scope jelas.

Discovery bukan bulk fetch. Runtime schema, generated manifest, OpenAPI atau metadata dapat mengurangi boilerplate; sample dibatasi dan diotorisasi bila metadata tidak tersedia. TypeScript interface yang terhapus saat runtime bukan discovery API. OpenAPI tidak membuktikan aggregation atau meaning domain; Standard Schema validator tidak selalu menyediakan introspection. [V12, V13]

Raw nested arrays tidak otomatis di-flatten, karena dapat menggandakan fakta. Child identity/relationship dan normalization lineage diperlukan. Binary/media/document data memakai safe preview reference. Data yang dapat dilihat pengguna belum tentu boleh dikirim ke LLM eksternal; egress adalah kebijakan terpisah.

## 7. Meaning, formula, dan pengetahuan domain

Schema menjelaskan bentuk. Meaning menjelaskan arti, grain, unit, identity, legal rollup dan domain semantics. Evidence menjelaskan asal, versi, asumsi, author dan activation scope. Numeric tidak otomatis summable. Count rows bukan employee count jika row mewakili employee-day. Missing check-in bukan otomatis absent.

Tiga tingkat derivasi: operasi atas meaning yang sudah dikenal, derivasi sementara untuk task/session, dan reusable domain definition. **Developer dapat mendefinisikan meaning langsung melalui kode/config bertipe dan memasangnya sebagai meaning bawaan aplikasi.** Dua mode authoring tetap **manual** dan **AI-assisted**; kode developer dan editor visual Studio adalah dua permukaan authoring manual, bukan dua engine. AI dapat membantu developer maupun domain author. Semuanya menghasilkan definisi canonical yang sama; tidak ada evaluasi JavaScript/SQL string dari pengguna atau model.

Definisi menyatakan dependencies, output type/unit/grain, aggregation properties, denominator-zero/null behavior, function versions, semantic scope dan provenance. Bahasa ekspresi dibatasi pada fungsi registered yang typed, bounded, reproducible; tidak membuat bahasa Turing-complete. Model inference atas free text berjalan di host/model port dengan evidence class inferred, bukan pure arithmetic AST.

Origin `system/ai-assisted/manual`, lifecycle `draft/active/deprecated`, dan scope `session/personal/workspace/organization` adalah dimensi berbeda. Low-risk temporary hypothesis boleh menurut policy dengan label; shared meaning memerlukan authority yang tepat. Approval menentukan siapa menerima definisi, bukan membuktikan kebenarannya. Perubahan membuat immutable version baru dan invalidates dependent plans; tidak menulis ulang sejarah hasil.

**Meaning bawaan siap digunakan, bukan ditulis ulang oleh end-user.** Developer mereuse schema/metric references yang sudah ada dan menambahkan hanya meaning, label/alias, unit/grain atau aturan yang belum diketahui. Definisi diperiksa saat build/startup/registration dan tetap divalidasi saat dipakai. Release pipeline yang diotorisasi dapat mengaktifkan bundle yang telah ditinjau; tidak perlu LLM, Studio, atau persetujuan ulang pada setiap pertanyaan. Label “developer-authored” sendiri tidak memberi izin. Opaque metric dari backend tetap sah melalui kontrak output yang jelas.

## 8. AI: pintar, tetapi bukan authority

AI boleh memahami bahasa, konteks multi-turn, semantic aliases, strategi investigasi, pertanyaan lanjutan, derived meaning draft, structured query, registered UI composition dan penjelasan hasil. AI tidak harus hanya memilih kata `trend`. Menyebut komponen registered sah sebagai proposal, bukan code execution.

Runtime tidak menerima raw executable JS/JSX/HTML/CSS/SQL, remote module URL, self-granted permission, fake data, atau approval yang diklaim model. Database implementation host boleh mengompilasi plan menjadi parameterized SQL; larangan ditujukan pada untrusted executable wire input, bukan melarang host memakai database.

MCP/WebMCP adalah jalur kemampuan, bukan model reasoning. Agent eksternal bisa melakukan reasoning sendiri; setiap tool call tidak memerlukan nested BYOK inference. BYOK menyediakan model port milik aplikasi, credential tetap di trusted server/environment. Protocol adapters harus feature-detect/negotiate versi yang diuji; native WebMCP tidak disamakan dengan mock browser. [V03, V14]

AI memakai konteks minimum yang cukup: metadata, summary dan bila diperlukan authorized bounded records/text. Tidak selalu cukup metadata saja; juga tidak berarti seluruh dataset dikirim ke model. Reasoning loop dibatasi turns/time/token/query/scan/egress dan observable progress. UI utama tidak wajib menampilkan seluruh logs.

## 9. Model lemah dan residual risk

**Invalid** dapat diperiksa: ID tidak ada, unit salah, forbidden operation, stale read set, capability tidak tersedia. **Ambiguous/valid-but-wrong** lebih sulit: metric sah tetapi bukan maksud pengguna. **Narrative error** bisa terjadi meski query/angka benar. Tidak ada slogan yang menggantikan perbedaan ini.

Binding outcome formal: `bound`, `needs-choice`, `needs-meaning`, `unsupported`, `denied`, `invalid`, `stale`. Bound berarti deklarasi yang diperiksa terpenuhi, bukan model pasti memahami pengguna. Candidate discovery yang tidak lengkap harus tetap dapat diperluas; satu exact match bukan confidence 100%. Material ambiguity meminta pilihan ringkas, bukan pertanyaan berulang untuk formatting sepele.

Grants bersifat per efek: read catalog/result, propose/evaluate task, propose/commit experience, propose/activate meaning, propose/execute action, dan model egress. Observe/suggest/compose/act hanyalah preset tampilan. Model kuat atau eval tinggi tidak meningkatkan hak secara otomatis. Principal dan confirmation berasal dari host context, bukan payload.

Fallback mempertahankan hasil yang masih sah, memberi diagnostic dan manual controls, lalu menghentikan repair loop yang tak berguna. Permission revocation harus membuang data lama yang kini terlarang. Repeated query fingerprint memakai normalized plan dan source versions, bukan ID yang dipilih model. Source berubah dapat membenarkan refresh; pengulangan sama tanpa progress memakai cache atau dihentikan.

Structured output dapat tetap salah. Nilai exact, unit, period, total dan verified status pada titles/tooltips juga harus berasal dari Result/Catalog, bukan narasi model. Claims menyatakan result/definition/scope/version dan evidence class; keberadaan citation tidak membuktikan entailment. [V01, V02]

## 10. Query planning dan multioutput

Logical plan terbatas pada scan/project/filter/approved join atau semijoin/group/aggregate/derive/time bucket/order/limit/cursor dan bounded window yang didukung. Validasi grain dan cardinality dilakukan sebelum/selama execution; dua one-to-many facts jangan digabung sehingga mengalikan nilai. Preaggregate atau semijoin digunakan ketika semantics memungkinkan.

Task named outputs menjaga ranking employee-period, trend employee-week, dan detail record-source tetap terpisah. Dependencies DAG tidak boleh cycle; reuse refs terikat revision/lease/scope. Fixed cohort menyimpan identitas dari hasil sebelumnya. Live cohort hanya dihitung ulang sesuai task yang eksplisit. Jumlah network request adalah physical optimization, bukan meaning task.

Three calendar months berbeda dari 90 days; resolve time sekali terhadap injected clock/timezone/calendar dan half-open intervals. Ratio-of-sums berbeda dari mean-of-rates, keduanya mungkin sah untuk estimand berbeda. Balance bisa semi-additive; distinct counts antargrup overlap tidak dijumlahkan. Mixed currencies tidak dikonversi tanpa source/policy yang jelas.

Pushdown dilakukan untuk pekerjaan besar. Residual lokal exact hanya bila input complete untuk populasi terkait dan memenuhi rows/bytes/time budget. API page tidak dapat membuktikan global top-K. Consistency multiquery hanya sekuat snapshot host; tidak ada transaksi global fiktif. Logical plan terpisah engine mempunyai prior art pada Substrait, tetapi Aeliqo tidak perlu mengadopsi seluruh format sebagai public API. [V15, V16]

## 11. Result dan resources

Result descriptor membawa schema/identity/grain/units/order/time/scope/coverage/precision/source freshness/definition versions/lineage. Counts memisahkan loaded, filtered total dan global total. Unknown tetap unknown. Estimated memerlukan method dan uncertainty; transport selesai tidak berarti seluruh populasi tercakup.

Immutable batches dan handles memungkinkan data besar tanpa copying seluruh arrays per event. Backpressure membatasi pending buffers. Result lifecycle membedakan loading, partial, ready, stale, denied, unsupported, cancelled, failed dan disposed. UI tidak menampilkan zero saat data belum ada. Retained previous result diberi label refreshing/stale bila sesuai.

Cache key memuat principal/policy/source/catalog/definition/query/time semantics. Model egress permission tidak disimpulkan dari cache visibility. Leases dibatalkan pada removal/authorization change; late responses tidak boleh overwrite request lebih baru. Source schema drift menjadi migration/gap, bukan guessed renamed fields. Persistence default menyimpan task/view choices, bukan records sensitif atau credentials.

## 12. Pemilihan UI dan abstraksi yang scalable

Presentation compiler menerima bound Task, Result/predicted descriptor, measured statistics yang aman, Experience profile, renderer capability, environment, dan current state. Ia menyusun information/operation requirements, menghasilkan bounded candidates, memvalidasi, lalu memilih kandidat valid dengan mempertimbangkan change cost.

Candidate dapat berasal dari incumbent valid, approved pattern expansion, bounded composition tanpa preset, atau registered proposal manusia/AI. **Pattern membantu, bukan gerbang wajib.** Role merupakan metadata fungsi, bukan enum domain yang harus ditambah untuk setiap industri. Public `Table/Trend/Explorer` tetap ergonomic; internal grammar tidak berupa arbitrary DOM atau HRDashboard.

Hard constraints adalah irisan semantics, authorization, task operations, accessibility, explicit user restriction dan profile capability. Tidak ada prioritas yang membuat security atau a11y dapat dikalahkan skor estetika. Bila tidak ada feasible candidate, kembalikan conflict/unsupported; search budget exhaustion berbeda dari bukti tidak ada solusi.

Cari satu pengalaman valid terlebih dahulu, lalu optimasi bounded. Pertahankan incumbent jika alternatif tidak memberi manfaat berarti. Index capabilities, prune irrelevant candidates, decompose kebutuhan dan cache subplans. Jumlah 71 komponen bukan penyebab otomatis combinatorial explosion; enumerasi semua kombinasi yang harus dihindari. Batas ekspansi hanyalah engineering budget yang diukur. Constraint-based visualization memiliki prior art, bukan bukti planner Aeliqo optimal. [V17]

## 13. Primitive, compound, dan graph

Grammar mencakup structure/content/collection/control/visualization/approved action-navigation. Node memiliki stable role identity, registered kind/version, result binding, config schema dan typed ports. Callbacks trusted lokal dapat ada melalui documented API, tetapi tidak diserialisasi sebagai code string agent.

Containment UI adalah tree dengan root/parent/reading-order jelas. Output dependencies adalah DAG. Interaction links adalah graph typed dengan approved mappings. Cycles hanya untuk equivalence propagation yang convergent dan diuji; causation IDs sendiri tidak membuktikan setiap cycle aman. Compounds boleh memiliki coordinator kecil, tetapi tidak menduplikasi selection/query/permission engine.

Plot specification menangani marks, encodings, layers/facets/concat sesuai subset teruji, scale sharing, legends dan interaction. D3 adalah implementation detail untuk geometry. SVG default, Canvas untuk dense data terukur dengan accessible exact-value exploration. Semua form/text utama tetap DOM/native. New extension membutuhkan manifest, typed config, semantics, state transfer, realization dan conformance, bukan model-provided module URL. [V18]

## 14. Adaptasi layar, interaksi, dan accessibility

Environment memakai container aktual, text scale, locale/direction, input capabilities, reduced motion/contrast serta navigation surface. Unknown SSR size bukan angka 0 atau width desktop rekaan. Coarse pointer tidak berarti tidak ada keyboard.

Local adaptation mengubah spacing/label density/wrapping dalam envelope komponen. Representation adaptation mengubah Table/List atau visual variant bila task operations setara. Composition adaptation mengubah master-detail menjadi drill-in atau tab hanya jika tidak merusak kebutuhan pengguna.

Semua field reachable belum tentu mempertahankan task. Perbandingan simultan delapan kolom tidak selalu setara dengan dua kartu yang harus dibuka bergantian. Table dua dimensi dapat mempertahankan scrolling yang sesuai; bagian page lain tetap reflow. Jangan otomatis mobile-to-card atau mengecilkan font untuk menghindari zoom. [V04]

Stable entity/field/role IDs menjaga selection, focus, draft, navigation dan user preference. Dirty forms, IME, drag dan critical dialogs menunda perubahan struktur yang merusak. Hysteresis/dwell/coalescing mencegah jitter; screen resize tidak memanggil LLM. User intent yang lebih baru mengalahkan proposal stale melalui read-set validation, bukan last-response-wins.

Target WCAG 2.2 AA supported complete flows, native semantics, APG reference patterns, actual keyboard/AT/zoom/RTL testing. Axe tidak membuktikan compliance. Dense plots dan virtualization membutuhkan accessible navigation, bukan seratus ribu hidden focusable nodes. Confirmation tindakan bisnis berbeda dari undo presentasi. [V05]

## 15. Stack dan agnostic rendering

Target tetap TypeScript strict, pnpm workspaces, runtime schema tunggal, Lit/native custom elements sebagai shared web implementation, thin React binding, native CSS layout, modular D3 geometry, SVG/Canvas yang dibatasi, Vitest/property tests/Playwright, dan Astro untuk content site. Versi dependency exact diverifikasi serta dipin pada M0, bukan difiksikan dari ingatan.

Lit bukan dogma. SSR/hydration, form association, ARIA/focus across shadow boundaries, React controlled state, vanilla use, Vue embedding dan bundle/input cost harus lolos feasibility gate lebih dahulu. Lit SSR didokumentasikan sebagai experimental Labs; status ini tidak disembunyikan. Bila blocker terukur muncul, ubah platform module melalui ADR, bukan tulis ulang katalog per framework atau menyebut browser-only sebagai SSR. [V06, V19]

Core dapat digunakan tanpa React/DOM. Satu implementasi web mengurangi duplikasi per frontend framework; native platforms tetap membutuhkan realisasi dan conformance nyata. Renderer-agnostic bukan zero adapter everywhere. Renderer memiliki kecerdasan platform (measurement, focus, layout), tetapi tidak menebak domain meaning.

## 16. DX dan designer experience

Empat jalur adopsi: komponen langsung; semantic descriptor yang dapat dipakai ulang; smart region dengan data service dan profile; agent control optional. Satu value/button tidak memerlukan catalog/LLM/cloud. Record identity tidak boleh diam-diam memakai row index ketika linked state dibutuhkan.

Aeliqo menyediakan standard opinionated: tokens, type/spacing, control metrics, variants, patterns, focus/motion/empty/error rules. Teams menyesuaikan brand/content/approved slots/profiles, bukan membangun mini-CSS language atau semua screen dari awal. Extension advanced tidak menghapus conformance boundary. Code dan Studio mengedit document model yang sama.

Local Studio OSS mempunyai Data & Meaning, Experience, Component Gallery dan Inspect. Designer dapat memeriksa sizes/states, mengubah tokens, membatasi pattern dan melihat alasan keputusan. End-user tidak harus memahami AST. CLI/init/doctor mengimpor metadata, menunjukkan gap dengan remedy, dan tidak diam-diam men-scan production API.

Uji onboarding dengan developer/designer independen: waktu hingga komponen pertama, local source, HTTP service, region, agent, token edit, narrow preview dan memahami satu gap. Nilai keberhasilan adalah pekerjaan selesai dan glue code berkurang, bukan sedikit baris kode yang menyembunyikan setup.

**DX developer-first untuk meaning:** helper bertipe dengan autocomplete field/metric, reuse schema tanpa duplikasi, error berlokasi pada expression, serta test/preview lokal tanpa provider key. Tidak perlu menentukan chart/layout di definisi meaning. Bundle kode memiliki revision dan kepemilikan repo; Studio menampilkannya read-only atau menghasilkan proposal/diff untuk direview, bukan diam-diam mengubah source. AI/session meaning tidak boleh menimpa definisi itu dengan ID/revision yang sama. Perubahan menjadi versi baru atau turunan ber-ID berbeda, dengan scope dan pemilihan eksplisit. Registrasi idempotent hanya untuk isi canonical yang identik; konflik isi ditolak.

## 17. Website, docs, dan playground

Lima jenis halaman: home, docs, playground, blog, reusable footer-content. Shared clean light/dark/system theme, logo kiri, Docs/Playground/Blog, GitHub kanan, theme toggle. Full-width shell dengan reading column yang tetap nyaman. Tidak memakai poster enterprise penuh ikon atau gradient sebagai arsitektur UI.

Home memiliki positioning, install versi yang benar, satu live proof dari package nyata, tiga level produk, jalur integrasi, batas support dan OSS story. Tidak ada hardcoded dashboard yang diberi badge live, customer logo palsu, atau benchmark yang belum dijalankan.

Docs memiliki per-component routes, API generated dari schema/export, Preview/Code per example, source yang benar-benar compile dari tarball, search/deep links, support matrix, migration version reset dan troubleshooting. Jangan menampilkan banyak sidebar label dengan target kosong yang sama.

Playground berpusat pada hasil, dengan source chooser dan request bar ringkas. Data/task/experience/activity inspector secondary. Agent connection states jelas, keys server-side, synthetic fixtures diberi label, no-model path nyata. Narrow memakai drawer yang accessible, bukan tiga panel diperkecil. Evaluate beberapa query tidak otomatis membuat banyak chart. Export tidak membawa raw sensitive data/credential.

Blog dan content pages memakai typography, sources, dates serta navigation yang konsisten. Studio local berbeda dari commercial service. Detail desain/screen-state acceptance berada di `docs/38-public-site-docs-playground.md`.

## 18. Katalog lengkap dan definition of done

Semua 71 entry di `harness/components.json` wajib diimplementasikan untuk advertised 0.1.0 scope: foundation/layout, inputs/forms, navigation, feedback/overlays, collections/data, 2D visualization dan semantic compounds. Nomor katalog tidak boleh diperkecil demi deadline tanpa keputusan scope eksplisit pemilik. Ia bukan janji setiap widget dunia, GIS penuh, enterprise scheduler atau rich-text IDE.

Setiap komponen: typed ergonomic API, direct import isolation, controlled/uncontrolled bila relevan, keyboard/touch/focus, complete applicable states, theme/forced-colors, locale/RTL, large text, SSR/hydration pada supported matrix, cleanup, source examples, baseline visual dan user-task tests. Decoration tidak perlu state loading fiktif, tetapi applicability harus dinyatakan.

Direct/semantic/region/compound menggunakan implementasi yang sama. Satu manifest mengikat capability/config/event/schema/docs/Studio/test reference. `done` membutuhkan code, public export, tests, evidence dan independent review; manifest atau screenshot saja tidak cukup.

## 19. Performance dan scalability

Target awal, bukan hasil terukur: standalone control incremental <=15 KiB gzip di luar shared Lit dan total tetap dilaporkan; table incremental <=40 KiB; lazy core planning <=70 KiB; initial region+table <=160 KiB total JS di luar host React. Budget wajib diperiksa pada built tarball consumers, bukan source guesses.

Reference workload planner 30 views/64 expansions menargetkan p95 <=16 ms, targeted state update <=4 ms, simple local input-to-visible-update <=100 ms. Main-thread work panjang harus dipecah/yield atau worker yang terukur. Budget tidak universal lintas hardware; environment/warmup/repeats/raw observations/p95 dan noise dilaporkan. Whole-page Web Vitals berbeda dari microbenchmarks. [V07, V20]

Batas source rows, rows transferred, rows retained, DOM rows dan geometry marks terpisah. Backend jutaan records tidak diunduh ke browser untuk membuktikan scale. Reuse immutable handles, targeted dependency indexes, caches bounded by bytes/TTL dan policy invalidation. Catalog context paged; 10.000 fields tidak dikirim per token/click. Worker pools bounded; kecil tetap synchronous bila lebih murah.

Cold/warm, source latency, rapid input, streaming backpressure, repeated mount/dispose, cancellation storms, null-heavy data, long labels, high-cardinality series, concurrent agents dan low-power devices masuk matrix. Benchmark jobs terisolasi dari heavy parallel builds. Search exhaustion menghasilkan typed fallback; tidak melonggarkan correctness agar cepat.

Pixel precision berarti sesuai approved design pada controlled baselines per browser/font/OS/DPR, bukan bitmap identik universal. Jangan autoaccept semua visual diffs atau masking seluruh komponen. Actual paint tidak dibuktikan renderer-ready/requestAnimationFrame. [V08]

## 20. Security dan enterprise

Untrusted: prompt, model output, source text, schema import, saved state, network stream, extension config. Trusted code: reviewed components/functions dan app executor/action. Client validation membantu UX/defense-in-depth; backend tetap memeriksa field/row/action permissions dan derived dependencies.

Read, compute aggregate, dan model egress berbeda. Approved aggregate-only capability dapat memakai field tersembunyi tanpa membocorkan raw data; arbitrary client expression tidak dapat declassify. Min-group suppression atau domain privacy policy berasal dari host. Jangan mengklaim differential privacy jika tidak diimplementasikan.

Limit schema/expression/query depth, operators, joins, projected fields, rows/bytes/time/concurrency. Hindari eval, prototype pollution, arbitrary module URL, SSRF, untrusted HTML. Safe text tetap bisa misleading secara naratif; escaping tidak memvalidasi meaning. Claims dan privileged action mempunyai batas sendiri. Prompt safety instructions tidak menggantikan authorization. [V02, V21]

Tenant/principal/policy versions mengikat handles/caches/snapshots. Revoke mematikan lease dan late effects. Audit/telemetry redacted by default, low-cardinality events, input/output recording opt-in, no production keys in prompts/browser/storage. CI least privilege, pinned actions, SBOM, license audit, secret scanning dan artifact digests. Model allowlist adalah host policy, bukan entitlement billing.

## 21. OSS menuju bisnis

Apache-2.0 untuk core, runtime, shared web components, React bindings, seluruh katalog wajib, data contract/helpers, query/presentation semantics, agent plumbing, local Studio/DevTools, testkit, auth hooks, basic audit export, security dan accessibility. Tidak ada artificial paid row cap, runtime phone-home/license check, atau production-quality feature sengaja ditahan. License grants existing tidak dihapus karena source rewrite. [V22]

Paid surface adalah pengoperasian lintas organisasi: hosted collaborative Studio, catalog/profile registry and rollout, approval workflow lintas tim, management-console SSO/SCIM, audit retention/search, fleet diagnostics, managed infrastructure/private deployment dan support/SLA. Implementasi commercial terpisah repository/license, menggunakan public contracts yang sama. Runtime yang telah dikonfigurasi tidak mati ketika cloud unavailable.

Tidak perlu menyelesaikan billing/control-plane enterprise penuh untuk merilis framework OSS. Halaman bisnis harus jujur tentang availability. Pricing diuji lewat paid pilot: biaya inference/storage/egress/support dipisahkan, BYOK tidak dibayar dua kali, tidak per-render runtime. Ukur repeated integration, task success, reduction in glue code dan willingness to pay; jangan menyebut product-market fit sebagai fakta.

## 22. Validasi ide dan pembanding

Mekanisme semantic layers, logical query plans, declarative visual composition, web components dan constrained recommendation memiliki prior art. A2UI dan Tambo juga menunjukkan area agent-to-UI yang beririsan. Itu bukan alasan meninggalkan produk, tetapi menolak klaim “belum pernah ada”. [V15, V17, V18, V23, V24]

Tesis pembeda Aeliqo: owned complete production UI system yang menggabungkan domain-governed meaning, query orchestration, no-preset composition, task-preserving adaptation, reasoning optional, dan conformance data-to-interaction. Pembuktian harus berupa equivalent tasks dan biaya adopsi, bukan hanya tabel fitur.

Uji tanpa AI, template baseline, governed AI proposal, serta ablation recovery/adaptation. Gunakan HR mentah, commerce non-dashboard dan held-out service/support domain. Bandingkan intent, computation, useful UI, task completion, narrative grounding, excessive clarification/view churn, cost/latency dan recovery. Simulated model bukan real provider evaluation. Correct numbers belum tentu correct conclusion: Simpson-type mixture, fixed/live cohort, missing/zero, ratio/mean dan fanout menjadi counterexamples independen.

## 23. Codebase dan pengerjaan dengan Codex

Target package tree: core, runtime, web, react, agent, devtools, testkit; apps site/playground/studio; examples vanilla/react/vue/server-data; fixtures; tests contracts/semantics/runtime/browser/visual/consumers/agents; docs; harness; scripts. Folder dibuat saat implementasi nyata dimulai, bukan ratusan placeholder.

Astra Medium orchestrator dan Luna Max subagents adalah pilihan pengguna. Resolve model IDs/efforts dan capability aktual client; jangan menebak atau silently downgrade. Provider docs bukan bukti setting session aktif. `configure_agents.py` membutuhkan verified local evidence. Preserve global skills/plugins; gunakan project-local skills. [V25, V26, V27]

Parallelism = min(actual spawn slots, ready independent tasks, resource capacity). Satu task/worktree/writer dengan paths jelas; orchestrator pemilik contracts/root config/lockfile/integration/release; reviewer read-only tidak menyetujui karya sendiri. Tidak ada recursive swarm. Benchmark tidak bersaing dengan worker builds.

Loop: acceptance -> test -> implement -> focused validation -> independent review -> fix -> atomic commit -> checkpoint -> lanjut. Evidence terikat source/design/commands/acceptance digest; status bookkeeping dikecualikan untuk menghindari circularity. Digest mendeteksi stale evidence, bukan sertifikat kejujuran. Actual CI/artifacts tetap wajib. AGENTS adalah index singkat, bukan seluruh buku. [V28]

## 24. Pelaksanaan dan quality gates

M0 memeriksa environment/repo/license/registry/model/stack dan membuktikan shared-web feasibility. M1 membekukan canonical contracts dan negative tests. M2 data/query/results. M3 runtime/typed interaction. Satu early full vertical slice harus membuktikan raw data -> multioutput -> UI -> interaction sebelum katalog diperluas. Lanjut foundation/components/2D, compositional planner, agent and derived authoring, Studio/docs/site, production evidence, RC/staging/rollback, release dan live verification.

Semua output produksi masih planned sampai diuji. Testkit/reference helpers bukan implementation substitute. Unit/property, integration, browser, built consumers, visual/a11y manual, model/protocol, performance, security, operations dan independent reviewer dipisahkan. External credentials/hardware/review yang belum ada menjadi BLOCKED; lanjut task independen tanpa mengarang PASS.

Public examples harus compile terhadap exact packaged artifacts di luar repo. Release tidak boleh bergantung workspace aliases. Tidak ada `passWithNoTests`, autoaccepted screenshot, mock dianggap native, blanket skip, atau menaikkan budget hanya agar green. Coverage persentase tidak menggantikan critical transition/failure-case tests.

## 25. Reset 0.1.0 dan hapus existing dengan batas yang benar

Instruksi terkini adalah target **0.1.0** dan rewrite source bersih. Tree baru tidak membawa runtime lama; Git history dan rollback disimpan. Foundation branch baru memberi kebebasan rewrite tanpa menimpa live dengan dokumen. Pada promotion, semua old source implementation yang tidak dipakai dapat diganti melalui reviewed commit; resource production dihapus hanya dengan exact plan dan recovery reference.

Npm version yang pernah terbit tidak dapat ditimpa/digunakan ulang setelah dihapus. 0.1.0 secara semver berada di bawah 0.2.0/0.10.0; dist-tag dan migration harus eksplisit, bukan menganggap semua consumers upgrade. Jika 0.1.0 pada nama tertentu tidak tersedia, jangan unpublish atau diam-diam mengganti target. Tuntaskan code/evidence lalu laporkan collision untuk keputusan nama/namespace. [V09, V10, V11]

Publikasi beberapa npm packages dan deployment bukan transaksi atomik global. RC ke nonlatest tag, exact tarball consumer, immutable staging image, rollback rehearsal, stable publication, explicit tag promotion, live identity dan release notes. Backend bisnis tidak dimigrasi sebagai efek samping UI rewrite. Existing GitOps topology ditemukan dari repo/current system, bukan ditebak dari cerita infrastruktur.

Saat penyusunan master, GitHub read berhasil dan write kembali 403; tidak ada branch/deployment/npm mutation berhasil. Npm lookup container gagal DNS sehingga availability 0.1.0 belum terverifikasi. Skrip lokal menyediakan path publication aman dengan credential pengguna. Semua batas observasi dicatat; tidak disamakan dengan service down.

## 26. Selesai berarti apa

Produk selesai untuk release target ketika semua mandatory components, task scenarios dan relevant quality gates mempunyai source/artifact-bound evidence, examples dapat dipakai dari install bersih, docs cocok dengan API, model weak/strong boundaries dievaluasi, UX/a11y/performance memenuhi supported matrix, dan release/deployment diverifikasi sesuai tahapnya.

Master/harness selesai sebagai artefak saat dokumen, manifest, links, reference types/tests, version reset dan provenance konsisten. Itu deliverable sesi ini. Buku tidak membuktikan kode produksi yang belum ditulis.

Fondasi tidak diubah hanya karena brainstorming baru menarik. Counterexample yang nyata boleh mengubahnya melalui ADR, regression dan migration. Pertahankan empat konsep publik, authority yang tegas, primitive milik sendiri, smartness yang compositional dan bukti end-to-end. Itulah cara membangun ambisi besar tanpa menjadikannya kumpulan abstraction yang tidak pernah siap dipakai.

## 27. Peta bacaan dan sumber

Spesifikasi rinci: `docs/00-decisions.md` sampai `docs/41-engineering-operating-standard.md`. AI failure containment: bab 37. Website/docs/playground: bab 38. Rekap feedback: bab 39. Riset primer terkini: bab 40. Acceptance/performance/component catalog/evaluation masing-masing mempunyai chapter dan machine manifests.

Sumber V01–V30 dirinci di [riset terkini](docs/40-current-research.md), dengan URL primer, tanggal pembacaan, implikasi, serta batas inferensi. Riset mendukung mekanisme tertentu, bukan klaim Aeliqo sudah tercepat, bebas halusinasi, universal, atau nomor satu.

Mulai: [START-HERE](START-HERE.id.md), [AGENTS](AGENTS.md), [prompt implementasi](PROMPT-START.md), [validasi aktual](VALIDATION.md). Seluruh dokumen dalam paket ini merupakan satu edisi dan tidak perlu ditumpuk dengan ZIP lama.

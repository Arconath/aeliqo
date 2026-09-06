# 02 — Smartness: level, mode, and ownership

## Dua sumbu yang tidak boleh tercampur

**Level komposisi:** L1 primitive (termasuk control, data display, dan visual primitive), L2 semantic compound, L3 workspace. L0 tokens/behavior utilities hanya fondasi implementasi, bukan level produk baru yang harus dipahami user.

**Mode kontrol:** explicit, adaptive, agent-directed. Satu L1 dapat adaptive; satu L3 dapat sepenuhnya explicit. Tidak ada “AI variant” terpisah yang menduplikasi komponen. Mode adalah permission/policy terhadap perubahan, bukan renderer lain.

| Sumbu smartness | L1 | L2 | L3 | Invariant |
|---|---|---|---|---|
| Presentation | Label, density, encoding, overflow | Memilih variant untuk task yang sama | Memilih komposisi blok yang kompatibel | Pertanyaan user tidak diam-diam diganti |
| Layout | Container fit, min-size, local affordances | Master/detail atau comparison arrangement | Priority, grouping, reading order, pins | Focus/draft/manual intent tidak hilang |
| Data | Unit, type, formatter, nullable state | Metric comparability, valid grouping | Binding context, scope, source revisions | Tidak mengarang currency/join/formula |
| Interaction | Selection, keyboard, brush, editing draft | Linked controls dan drill | Propagation lintas node, undo UI | Events typed, bounded, cycle-safe |
| Agent | Descriptor capability | Semantic task contract | Transactional intent application | Runtime validates, host memilih tools |
| Resource/a11y | Render budget, fallback semantics | Progressive detail dan lazy loading | Schedule visible work; preserve navigation | Optimasi tidak membuang correctness/a11y |

## Smartness bukan selalu inference

CurrencyValue memilih formatter dari currency+locale; tidak membutuhkan model. Trend menyederhanakan ticks berdasarkan ukuran container; itu aturan deterministik. Comparison menolak menggabungkan score benchmark berbeda; itu semantic validation. Workspace dapat memilih layout dari constraint/pin; itu planner lokal. Agent hanya diperlukan ketika menerjemahkan tujuan yang belum berupa operasi terstruktur atau membantu eksplorasi.

Inference dari nama kolom boleh menghasilkan **draft suggestion**, misalnya `price` mungkin money. Statusnya `unconfirmed`; tidak boleh dipakai untuk conversion, aggregations, atau irreversible action. Developer mengonfirmasi descriptor atau memakai explicit fallback.

## Policy yang dapat dipahami developer

Gunakan tiga kategori perubahan: `presentationOnly`, `queryMeaning`, `businessAction`. Presentation-only dapat diizinkan otomatis pada komponen adaptive. Perubahan queryMeaning harus valid menurut descriptor, disetujui policy, dan tampak di active filters/period/grain. BusinessAction memanggil ActionPort terpisah dan sesuai otorisasi aplikasi.

Policy dapat membatasi variants, min/max density, allowed layouts, transform capabilities, dan auto-refresh. User pin mengunci bagian tertentu (representation, position, filter, atau seluruh node), bukan harus membekukan seluruh workspace. Runtime melaporkan reason code saat permintaan tidak dapat diterapkan karena pin atau ukuran.

## Stabilitas dan prediktabilitas

Urutan prioritas: explicit user intent/pin → constraint data/a11y → ukuran container → task fit → preferensi/default. Hard constraints selalu dieliminasi dulu; scoring hanya untuk kandidat valid. Tie-break berdasarkan preference lalu ID deterministik. Jangan membuat hidden semantic change karena skor layout sedikit lebih baik.

Hysteresis dan debounce hanya untuk perubahan struktur/variant, tidak untuk input langsung. Nilai awal untuk dievaluasi: buffer breakpoint 24 px, resize stabilization 120 ms. Ini target desain, bukan konstanta universal; benchmark dan interaction test dapat mengubahnya melalui ADR. Saat user mengetik/dragging/IME composition, tunda adaptasi struktural yang menyentuh owner interaksi tersebut.

## Explainability yang berguna

Simpan reason codes singkat seperti `container_narrow`, `ordinal_comparison`, `mixed_currency`, `pinned_by_user`, `partial_dataset`, `unsupported_query`. Inspector dapat menampilkan sumber constraint dan alternatif valid. Jangan mengklaim model confidence probabilistik dari heuristic score. End-user tidak harus membaca planner internals; tampilkan alasan hanya saat relevan, misalnya “Tampilan daftar dipakai karena panel sempit.”

## Batas keumuman

Smartness mengikuti capability aktual, bukan daftar intent berbahasa alami yang harus di-hardcode semuanya. Grammar mengomposisikan konsep reusable; registry memungkinkan domain extension. Namun task yang membutuhkan data/operation/component yang belum tersedia tetap unsupported. Tujuan desain adalah ekspansi tanpa core fork dan tanpa kehilangan correctness, bukan klaim mampu melakukan segala hal.

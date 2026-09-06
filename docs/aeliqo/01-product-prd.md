# 01 — Product requirements

## Produk dan janji yang akan diuji

Aeliqo menyediakan komponen aplikasi data-heavy yang siap dipakai, mempunyai kontrak makna data, mampu menyesuaikan representasi tanpa merusak meaning, dan dapat dikomposisikan menjadi workspace yang dikendalikan manusia maupun agent. Komponen harus bernilai **tanpa AI**. Integrasi agent mengurangi pekerjaan manual; bukan syarat untuk filter, hover, resize, navigation, edit, atau rendering.

Target awal developer dan platform team React yang saat ini merakit table, chart, detail panel, filters, dan agent bridge dengan glue code terpisah. Kita tidak mengklaim semua industri, semua framework, atau semua intent langsung tercakup.

## Tiga pekerjaan utama

**Explore dan bandingkan.** Pengguna memilih entitas, memfilter capability, membandingkan metric yang compatible, melihat detail dan provenance. Demo awal model AI menggunakan snapshot sintetis; bukan price tracker aktual. Domain lain harus bisa memakai komponen yang sama tanpa mengubah core.

**Pantau dan investigasi.** Pengguna menghubungkan time series, rankings, dan details dengan shared selection, mempertahankan konteks saat data berubah, serta memahami batas completeness/freshness. Framework tidak menyatakan korelasi sebagai akar penyebab.

**Susun ruang kerja.** Pengguna mengatur blok dan density, mengunci bagian yang penting, menyimpan presentasi lokal, lalu menerima bantuan agent tanpa kehilangan draft atau focus. Adaptive bukan layout yang terus melompat sendiri.

## Pengalaman end-to-end minimum

Developer memasang satu component dengan data lokal; tampil dengan styling bawaan yang matang. Ia dapat mengganti tokens atau slots tanpa fork. Saat butuh business semantics, ia mendaftarkan descriptor sekali dan memakai binding yang sama pada table/chart/comparison. Ia menambah workspace untuk linked interactions, lalu mengaktifkan adapter agent terpisah. Setiap langkah mempunyai quickstart dan runnable example sendiri; tidak ada kewajiban melompat langsung ke abstraksi paling kompleks.

User produk tidak harus mengetahui MCP. Dalam workspace yang sudah dipasangkan, “bandingkan tiga ini dalam chart” menghasilkan perubahan pada workspace atau alasan kegagalan yang jujur. “Jelaskan saja di chat” tidak mengubah layout. Bila ada dua workspace tanpa target jelas, runtime tidak memilih tab secara sembarang.

## Functional requirements

| ID | Requirement | Bukti penerimaan |
|---|---|---|
| P01 | Primitives berguna standalone | Consumer hanya mengimpor primitive, tanpa agent/workspace |
| P02 | Compound dibangun dari primitive yang sama | API/behavior parity dan tidak ada style fork |
| P03 | Workspace linked state typed | Selection/filter lintas blok memakai entity/relation eksplisit |
| P04 | Makna data benar | Money, ratios, time, partial data, join cardinality tests |
| P05 | Adaptasi dapat dibatasi/dijelaskan | Pin, explicit mode, reason codes, focus preservation |
| P06 | Agent dapat mengubah UI lewat kontrak yang sama | Manual/MCP/BYOK/WebMCP parity sesuai support matrix |
| P07 | Extension tanpa core fork | Dua contoh domain/component eksternal lolos conformance |
| P08 | Docs membantu adopsi | External user menyelesaikan tugas integrasi tanpa bantuan founder |
| P09 | Library ringan sesuai pemakaian | Import isolation dan production bundle report |
| P10 | Produk OSS bermanfaat sendiri | Tidak ada required cloud/license network check pada core |

## Non-goals fase pertama

Tidak membuat arbitrary website agent, general BI database, LLM runtime baru, editor 3D, universal no-code builder, ataupun scheduler/pivot enterprise lengkap sebelum ada pembeli. Tidak menjanjikan framework tanpa batas: extensibility harus jelas; unsupported intent mengembalikan capability gap, bukan fake success.

## Product gates

G0 membuktikan PoC dapat dipertahankan. G1 membuktikan kontrak/data correctness. G2 membuktikan satu set komponen kecil tetapi matang. G3 membuktikan adaptive workspace dan MCP-to-browser, termasuk intent tanpa menyebut protokol. G4 menambah docs dan optional adapters. G5 menguji adopsi eksternal dan paid pilot. Kuantitas katalog bukan release gate.

Keberhasilan produk diukur dari integrasi yang dipakai lagi, waktu setup, correctness task, jumlah custom glue code yang dapat dihilangkan, kualitas UI, dan kemauan membayar. Stars, demo yang mengesankan, dan jumlah schemas bukan pengganti retensi atau penjualan.

# Aeliqo 0.1.0 Master consolidation — desain konsolidasi

**Status: blueprint implementasi dan harness, bukan framework 0.10 yang sudah selesai.**

Aeliqo tetap framework UI aplikasi, tetapi UI-nya dikompilasi dari kebutuhan pengguna dan data aplikasi. Ia tidak mengambil alih database, autentikasi, business service, routing utama atau deployment seluruh aplikasi. Ia memiliki komponen dan bahasa pengalaman sendiri, bukan sekadar membungkus komponen customer.

## Empat kontrak yang perlu dimengerti

**Catalog** menjelaskan apa yang tersedia, tipe/makna/relasinya dan kemampuan query yang benar-benar didukung. **Task** menjelaskan kebutuhan pengguna, data/perhitungan/operasi yang dibutuhkan dan preferensi yang harus dihormati. **Result** berisi hasil plus identitas, cakupan, satuan, waktu, kelengkapan, dan asal perhitungannya. **Experience** menetapkan pola, representasi, token, izin adaptasi dan aturan pengalaman Aeliqo.

```text
Sumber data aplikasi
  → Catalog yang sudah dibatasi izin
  → bahasa pengguna / manual / agent
  → Task + definisi meaning yang valid
  → rencana query → eksekusi milik aplikasi
  → Result + metadata/cakupan
  → compiler presentasi + Experience + ukuran container
  → graph primitive/2D → runtime interaksi → UI web
  ↳ interaksi selection/filter/range mengubah parameter secara deterministik
```

## Agnostic tanpa segudang adapter

Aplikasi menyediakan satu Application Data Contract. Local/in-process dan HTTP membawa kontrak yang sama. Import OpenAPI/schema membantu penulisan metadata, tetapi tidak otomatis menjelaskan business meaning, relasi atau bagaimana endpoint menghitung agregasi. Tidak ada janji menghubungkan API apa pun tanpa integration work.

Untuk UI web, targetnya satu implementasi shared: native custom elements berbasis Lit, HTML/CSS, D3 modular untuk geometry, SVG terlebih dahulu. React menjadi binding tipis, bukan katalog kedua. Vanilla wajib terbukti. Kompatibilitas Vue diuji sebagai embedding, bukan rewrite. Native iOS/Android renderer tidak diklaim tersedia.

Lit/SSR/form/shadow/accessibility masuk gate awal yang memblokir implementasi besar. Pemilihan stack harus dibuktikan dalam consumer sebenarnya; kalau gagal, ganti batas platform melalui ADR, jangan menambahkan implementasi ganda.

## Smartness yang dipertahankan dan diperluas

AI memahami maksud, mempertahankan konteks, mengusulkan derivasi, memperbaiki ambiguitas dan menyusun task. Runtime memvalidasi serta mengeksekusinya. Derived meaning memakai satu bentuk typed definition, baik ditulis manual maupun dibantu AI. Hipotesis session berisiko rendah bisa diizinkan dengan label dan kebijakan; meaning organisasi/consequential perlu authority yang tepat. Type-check berhasil bukan bukti meaning bisnis benar.

Query memeriksa grain, relasi, fanout, null, currency, ratio-of-sums, periode, izin dan kelengkapan. UI memilih representasi berdasarkan task, hasil, operation yang diperlukan, desain, ukuran, input dan preferensi. Agent tidak menggambar arbitrary JSX/CSS dan tidak perlu dipanggil untuk tiap klik/resize.

## Mobile bukan sekadar mengganti table menjadi list

Field yang masih bisa dibuka belum tentu berarti tugas pengguna masih bisa dilakukan. Perbandingan lintas kolom membutuhkan representasi yang mempertahankan perbandingan, termasuk scroll dua dimensi bila memang esensial. Pilihan tabel eksplisit tidak dibatalkan diam-diam. Fokus, selection, draft dan IME harus bertahan. Safety, correctness, accessibility dan task constraints berlaku bersama, bukan saling meniadakan.

## Lengkap, tetapi terukur

Katalog release yang tertulis wajib benar-benar diimplementasikan seluruhnya: komponen dasar, input/form, navigation, feedback/overlay, collection/table, visual 2D, serta compound. Setiap komponen punya standalone API, state, keyboard, a11y, visual matrix, docs dan import/performance evidence. Kata complete bukan janji semua widget yang mungkin ada di dunia.

Performance budget adalah target uji, bukan angka benchmark yang sudah tercapai. Pixel precision dibuktikan terhadap baseline per browser/font/OS/DPR; tidak dijanjikan bitmap sama antarseluruh sistem operasi.

## OSS dan bisnis

Runtime, keamanan dasar, aksesibilitas, seluruh katalog wajib, agent protocols, local Studio dan testkit tetap Apache-2.0. Kolaborasi hosted, organisasi/governance terpusat, retensi, operasi dan kontrak support dapat berbayar dalam produk terpisah. Jangan membuat produk OSS sengaja tidak aman atau tidak lengkap agar enterprise mau membayar.

## Cara implementasi

Mulai dari PROMPT-START.md dengan AGENTS.md. Astra medium mengintegrasikan; Luna max menangani tugas independen sebanyak kapasitas runtime dan resource yang terbukti. Tidak ada model ID atau effort mapping yang ditebak. Jangan ubah global skills/plugins lama.

GitHub write dari sesi penyusunan kit ini ditolak 403; remote belum diubah. `scripts/publish_git.py` menyediakan publikasi satu commit di branch rewrite baru melalui autentikasi lokal. Source history tetap dipertahankan, tetapi tree rewrite bersih. Production lama tetap hidup sampai kandidat baru lolos gate. Versi npm lama tidak ditimpa; target stable baru adalah 0.1.0.

Lihat [peta dokumentasi](docs/README.md), [rencana implementasi](docs/20-execution-plan.md), [traceability requirement](docs/25-traceability.md) dan [batas observasi](docs/26-observations.md).


## Yang sudah diperketat dalam Master consolidation

Pattern bukan template wajib; AI dapat mengusulkan komposisi terdaftar dan investigasi bertahap. Query evaluasi tidak otomatis memasang chart. Task mempunyai named outputs lintas grain dan jalur presentation/form tanpa query palsu. Read-set commit memeriksa seluruh versi yang relevan. Kontrak membedakan ukuran unknown, exact count, approximation dan inference. Tests pada reference memeriksa contoh ini, tetapi actual runtime/browser/provider tetap harus dibuktikan. Lihat [peta audit](docs/35-audit-resolution.md).

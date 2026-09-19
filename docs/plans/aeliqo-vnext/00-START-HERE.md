# Aeliqo — final execution plan v3

Tanggal: 19 September 2026. Repository: `Arconath/aeliqo`. Baseline source: `9092d6cff454b81cd623a7a4be7621c6a750d9c7`, dicek kembali melalui koneksi GitHub.

**Gunakan paket `aeliqo-vnext-final-v3.zip` ini menggantikan v1/v2, bukan sebagai tambahan terpisah.** Source produk belum diimplementasikan atau diuji oleh penyusun rencana. API vNext di dokumen adalah kontrak target, bukan export 0.4.2.

## Keputusan utama

Aeliqo tetap Adaptive Application UI, bekerja dengan atau tanpa AI. Renderer menerima controller surface, tidak semua props aplikasi. Definisi fitur terpisah dari data/aksi/scope hidup. Satu fitur dapat digunakan oleh beberapa surface tanpa berbagi filter atau izin secara tidak sengaja. Host tetap memiliki router, design system, backend, autentikasi, dan efek bisnisnya.

Dua hal berbeda sekarang sama-sama dicakup: mengubah tata letak workspace dalam scope yang sama, dan berpindah workspace/tenant yang memerlukan lifecycle/otorisasi baru. Pergantian sukarela menjaga draft lewat Save/Discard/Stay; pencabutan akses harus segera menutup akses lama. Request lama dan controller yang tersimpan tidak boleh otomatis diarahkan ke tenant baru.

Agent adalah koneksi opsional ke scope dan daftar target eksplisit. Model menerima metadata/konteks minimum yang diizinkan, bukan seluruh data/riwayat tenant. Dukungan model berdasarkan kemampuan/protokol teruji, bukan slogan semua model pasti berhasil.

## Urutan baca

1. `01-SPEC.md` — keputusan arsitektur dan perilaku wajib.
2. `08-CONTRACTS.md` — detail kontrak, lifecycle, contoh penggunaan dan batas tanggung jawab.
3. `02-EXECPLAN.md` — 22 task T00–T21 beserta test-first, dependencies, file dan gate.
4. `03-ACCEPTANCE.md` — 46 requirement RQ01–RQ46, coverage, pengalaman, skala dan release.
5. `04-RESEARCH.md` dan `09-AUDIT.md` — riset, temuan konkret, koreksi dan batas bukti.
6. `05-CODEX-PROMPT.md` — instruksi eksekusi lengkap.
7. `06-AGENTS-ADDENDUM.md` dan `07-EXECUTION-STATE.md` — panduan ringkas dan checkpoint.

`PLAN-INDEX.json` memetakan task/requirement. `contracts/contract-probe.ts` hanya model desain bertipe: bukan implementasi Aeliqo. `verify_pack.py` memeriksa konsistensi paket. `MANIFEST.json` menyimpan checksum; bukan tanda tangan penerbit.

## Eksekusi

Buka checkout yang benar di Codex dan lampirkan ZIP final-v3. Minta Codex membaca `05-CODEX-PROMPT.md`, memverifikasi remote, kemudian menaruh dokumen di `docs/plans/aeliqo-vnext/` tanpa membuat root baru. Temukan prefix archive dari manifest, jangan hardcode prefix v1/v2. Verifikasi salinan arsip murni di direktori sementara dahulu, baru reconcile ke folder docs yang mungkin sudah memiliki progress. Tolak traversal/symlink/entry duplikat atau ukuran tidak wajar. Jangan menimpa checkpoint atau kode yang lebih baru; gunakan pemetaan task lama→baru pada `PLAN-INDEX.json` dan catat rekonsiliasi.

Setelah unpack, pemeriksaan paket dapat dilakukan dari root folder paket:

```sh
python3 verify_pack.py
```

Baca script sebelum menjalankannya. Checksum berlaku pada handoff sebelum Codex memperbarui dokumen/checkpoint; perubahan sah sesudah eksekusi dimulai harus dicatat, bukan diklaim identik dengan arsip awal. Pemeriksaan ini bukan `pnpm check` dan tidak membuktikan production readiness. Untuk eksekusi Codex, paste isi prompt utama melalui aplikasi/CLI yang sudah dipakai; pertahankan pengaturan model, sandbox, approval dan biaya pengguna. Tidak perlu memasang agent framework baru.

## Batas izin dan cakupan

Rencana ini mencakup implementasi, tes, docs setiap komponen, migrasi dan kandidat rilis. Tidak memberi izin baru untuk bypass branch protection, panggilan model berbayar, publikasi npm atau perubahan produksi. Bila izin rilis memang sudah tersedia dan gate terpenuhi, eksekutor menyelesaikan jalur rilis yang diizinkan dan memeriksa bukti live-nya. Bila belum, laporkan gate spesifik, bukan keberhasilan palsu.

Dukungan web luas dicapai lewat batas engine/adapter yang jelas, adopsi per fitur, biaya yang dibatasi dan matriks pengujian. Jangan memaksakan semua framework/provider/database sekaligus atau mengklaim skala tanpa batas. User experience dan DX diuji dengan alur nyata, bukan hanya jumlah props atau halaman dokumentasi.

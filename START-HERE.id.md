# Mulai di sini — Aeliqo 0.1.0 master kit

Ini **pengganti penuh kit 0.10/R2**, bukan patch yang harus ditumpuk. Target produk sekarang 0.1.0; edition dokumen 1.1 (koreksi developer-authored meaning). SDK baru belum diimplementasikan. Jangan menghapus proyek aktif dengan mengekstrak ZIP di atasnya.

## 1. Folder kerja bersih

Ekstrak kit ke folder baru. Baca MASTER-SOT.md untuk keputusan final; detail berada pada docs bernomor. Gambar generatif lama bukan SoT. Development tidak harus menyalin source runtime lama; sejarah Git, identitas produk dan rollback tetap dijaga.

## 2. Verifikasi sebelum mengedit

```sh
python3 scripts/verify_integrity.py
python3 scripts/validate_all.py
```

Prasyarat kit: Python 3.11+, Node dan `tsc` untuk reference tests. Command kedua menguji harness, kontrak referensi dan eksperimen; bukan browser/runtime produk. Gate ready/release memang harus menolak foundation yang belum selesai. Periksa VALIDATION.md dan validation/current/summary.json. Setelah source sengaja diedit, checksum distribusi lama tidak lagi cocok; jangan menganggapnya validasi hasil implementasi baru.

## 3. GitHub dengan commit atomik

Repo yang sudah ada adalah Arconath/aeliqo. Gunakan autentikasi Git/gh lokal yang sah serta git user.name/user.email. Jangan memasukkan token ke prompt.

```sh
python3 scripts/publish_git.py
python3 scripts/publish_git.py --apply
```

Yang pertama dry-run tanpa jaringan/write. Yang kedua membuat satu commit clean-tree pada branch baru `rewrite/v0.1.0-master-foundation`, mempertahankan parent main tanpa menimpa main. Ia berhenti bila branch sudah ada. Ini tidak mem-publish npm dan tidak melakukan deployment. Percobaan write pada sesi pembuatan dokumen ditolak 403; jangan mengklaim remote sudah berubah.

Setelah branch dibuat, clone/checkout branch itu ke working directory baru melalui Git yang normal. Jangan menjalankan foundation publisher lagi untuk update implementasi; gunakan commit/PR atomik biasa.

## 4. Jalankan dengan Codex

Pilih Astra Medium untuk orchestrator dan tetapkan keinginan Luna Max untuk subagents. Tempel seluruh PROMPT-START.md. Agent memverifikasi ID model/effort/spawn/permissions yang benar-benar tersedia, bukan mengarang config. Tidak ada global plugin/skill v3.2 yang dihapus. Maximum useful parallelism memakai task siap dan ownership worktree, bukan banyak penulis pada file sama.

Agent diminta menuntaskan seluruh scope dan gates yang dapat dikerjakan, bukan berhenti setelah scaffold. Bila sesi berakhir gunakan PROMPT-RESUME.md. Bila sudah ada implementasi dari kit sebelumnya gunakan PROMPT-RECONCILE.md, jangan overwrite directory aktif.

## 5. Jalur implementasi

Preflight versi/registry/toolchain → platform SSR/form/a11y proof → contracts/query/runtime → proof end-to-end awal T39 → katalog lengkap dan komposisi → agent/model containment → website/Studio → real-provider/consumer/AT/performance → RC → stable 0.1.0 → cutover dan smoke.

Seluruh 71 komponen wajib tetap scope release. Prototype reference tidak boleh dipakai sebagai pengganti validator/query engine produksi. Tidak ada data palsu untuk menutupi source capability gap.

## 6. Batas yang tidak boleh dilewatkan

AI boleh mengusulkan meaning/query/view, tetapi tidak boleh memberikan dirinya izin. Model bagus tidak otomatis boleh action.execute. Proposal salah ditolak bila melanggar kontrak; interpretasi valid-tetapi-salah tetap residual risk yang perlu disclosure, clarification yang tepat dan eval. Tidak ada klaim bebas-halusinasi.

Versi npm 0.1.0 harus dicek per package. Jika sudah pernah digunakan, menghapusnya tidak membuat versi itu dapat dipakai ulang. Publikasi tepat versi itu blocked sampai ada keputusan owner; jangan diam-diam mengganti versi. Rilis lebih rendah dari 0.2/0.10 harus punya panduan migrasi eksplisit.

“Hapus existing” berlaku untuk legacy source/deployment yang digantikan setelah penggantinya siap. Jangan hapus database, .git, secrets, history atau layanan lain. Penghapusan resource lama harus memakai allowlist dan rollback evidence.

## Koreksi terbatas edisi 1.1

Target produk tetap 0.1.0. Koreksi ini mempertegas authoring meaning lewat kode developer, tanpa mengganti foundation. Baca [catatan perubahan](CORRECTION-DEVELOPER-MEANING.md). Untuk folder baru pakai kit ini sebagai pengganti edisi 1; untuk implementasi yang sudah berjalan, gunakan PROMPT-RECONCILE.md dan review diff, bukan overwrite source atau mengulang publisher foundation.

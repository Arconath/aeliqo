# 00 — Context, authority, and evidence

## Yang benar-benar diketahui

User sudah mempunyai PoC lokal dan meminta kelanjutannya. Blueprint v1 tanggal 5 September 2026 menetapkan library milik produk sendiri, tiga level UI, enam sumbu smartness, TypeScript core agnostik framework, React-first, D3 2D, MCP utama, BYOK opsional, dan WebMCP experimental. Blueprint juga menetapkan kepemilikan business state di aplikasi dan presentation state di runtime; ini tetap dipertahankan.

Keluhan tambahan yang mengikat: agent terkadang hanya menjawab data di chat walau user menginginkan perubahan live UI. User tidak seharusnya berulang kali menyebut nama protokol. Solusinya harus mencakup integrasi produk dan outcome tests, bukan menambah kalimat prompt saja.

## Yang belum diketahui

Tautan share tidak berhasil diambil; paket tidak mengklaim membaca seluruh percakapan di sana. URL Codex thread tidak bisa menjadi bukti source. Pencarian repo pada connector belum menghasilkan PoC yang dapat diaudit. Tidak ada working tree lokal terpasang pada lingkungan penyusunan. Karena itu nama npm package, repo path, dependency versions, existing architecture, jumlah komponen yang sudah ada, dan hasil benchmark masih **unknown**.

Ketiadaan bukti bukan alasan membangun ulang. Audit lokal di tahap G0 mengisi kekosongan ini. Temuan source yang berbeda dengan proposal harus dievaluasi dari invariant dan cost, bukan diganti semata-mata agar struktur direktori identik.

## Urutan otoritas

Instruksi host/user yang berlaku → kebijakan repo scoped → keputusan produk terbaru yang disetujui → contracts yang benar-benar diimplementasikan dan dites → proposal dalam kit. Existing behavior bukan otomatis benar, tetapi perubahan behavior harus eksplisit dengan tes/migrasi. Blueprint lama dipakai sebagai konteks, bukan disalin menjadi dua sumber kontrak aktif.

## Koreksi terhadap penjelasan sebelumnya

`AGENTS.md` lokal mengarahkan agent yang sedang bekerja di repo; tidak ikut tersisip secara ajaib ke setiap Codex/Hermes/browser pengguna produk. Nama/description/schema tool dan server instructions membantu discovery, tetapi MCP tidak menjamin model pasti memilih tool atau menjalankan semua langkah. Desain produk harus membedakan integrasi yang kita kontrol dan external harness. Dokumentasi Codex saat riset menyebut dukungan MCP server instructions; perilaku host lain harus dites sendiri. [R02, R04]

`presented` juga tidak boleh menjadi boolean spekulatif. Server mengantrekan pesan, React commit, data ready, dan visual outcome yang terlihat adalah tahap berbeda. Kontrak baru memisahkan lifecycle operation, render, dan data. Lihat 11 dan 12.

## Bahasa dan nama

Instruksi agen dan public-site copy memakai identifier/API berbahasa Inggris; penjelasan internal utama dalam bahasa Indonesia. Aeliqo adalah working product name. Semua contoh import `@aeliqo/*` adalah **usulan nama**, bukan klaim package tersedia. `3d.js` pada pesan user dibaca sebagai D3.js sesuai keputusan 2D sebelumnya; Three.js tidak ditambahkan.

## Bukti yang harus dibuat lokal

`current-state.md` mencatat branch/commit bila ada, status dirty, paths, commands, baseline, risks, dan keep/refactor/replace map. `exec-plan.md` mencatat milestone aktif. `evidence/` menyimpan hasil tes/traces/screenshot bila dihasilkan. Jangan mengisi kolom measured dengan angka target. Jangan menyimpan prompt pelanggan, secrets, atau dataset privat dalam evidence publik.

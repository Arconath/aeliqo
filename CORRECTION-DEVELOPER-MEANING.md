# Koreksi terbatas: developer-authored meaning

Target produk **0.1.0**, edisi spesifikasi **1.1**, 8 September 2026. Menggantikan edisi 1 untuk detail yang dikoreksi; empat kontrak publik, batas AI, arsitektur data/rendering, 71 komponen dan OSS/bisnis tidak berubah.

Developer boleh menyediakan meaning melalui typed code/config sejak awal. End-user langsung memakai meaning yang aktif/diizinkan, bukan diminta mendefinisikannya ulang. Dua mode tetap manual dan AI-assisted; manual mempunyai permukaan kode dan Studio. AI boleh membantu author mana pun. Semua memakai definisi canonical, validasi, dan evaluator yang sama.

DX wajib: reuse schema/metric refs, builder bertipe dan autocomplete, metadata diturunkan hanya bila terbukti, errors berlokasi, local preview/tests, dan zero model calls untuk jalur manual. Definisi meaning tidak memuat pilihan chart/layout. Opaque metric backend tetap didukung tanpa menyalin formula privat ke browser.

Meaning kode dimiliki repo; Studio read-only atau mengusulkan diff/revision. Same ID/revision dengan isi berbeda ditolak; shadow diam-diam tidak diizinkan. Reviewed deployment pipeline dapat mengaktifkan bundle menurut host policy tanpa approval tiap pertanyaan. Label developer bukan izin dan tidak membebaskan semantic/authorization validation.

Dokumen yang diselaraskan: MASTER-SOT §7/§16; docs00/03/09/21/22/30/39; AGENTS; prompt start/reconcile; catatan awal. Existing tasks T04/T06/T23/T25/T32 diperjelas; S65–S67 menambahkan penerimaan produk. Tidak ada task baru, dependency AI tidak ditambahkan ke jalur kode, dan tidak ada klaim implementasi SDK dari perubahan spesifikasi.

Contoh helper pada docs22 adalah target API, belum API npm. Produk harus membuktikan contoh dari artifact build nyata. Pengujian kit dilaporkan terpisah dalam VALIDATION.md. Snapshot kode/referensi lama dipertahankan; tidak ada GitHub/npm/deployment mutation pada revisi ini.

Untuk implementasi aktif: review perubahan terkait melalui diff, ikuti PROMPT-RECONCILE.md, dan invalidasi/rerun evidence terdampak. Jangan overwrite source, reset status, atau ulangi foundation publisher. Untuk mulai dari folder kosong, gunakan ZIP edisi 1.1 sebagai pengganti kit sebelumnya.

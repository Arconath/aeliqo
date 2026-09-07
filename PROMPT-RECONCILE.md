# Prompt reconcile — hanya bila implementasi lama sudah dimulai

Audit working tree/branches dan baca AGENTS.md serta KIT-REVISION.json Master consolidation sebelum menulis. Jangan unzip menimpa worktree aktif, reset, clean, menghapus kode yang belum di-commit atau menjalankan publisher foundation di atas branch yang sudah ada. Bandingkan Master consolidation dengan kit/source yang sedang dipakai di worktree terpisah.

Map setiap temuan docs/35-audit-resolution.md ke implementation aktual, tests dan acceptance. Pertahankan kode yang sudah benar. Integrasikan kontrak multioutput/queryless, metadata tagged, typed events, optional patterns, AI propose/evaluate/present dan read-set invalidation dengan commit migrasi atomik beserta regression tests. Sinkronkan paths, task DAG dan docs; jangan mengubah task menjadi done hanya karena penjelasannya diperbarui.

Catat decisions/source SHA dan jalankan focused tests lalu integrated gates yang terdampak. New candidate digest membatalkan evidence lama. Tetap gunakan Astra Medium dan Luna Max yang diverifikasi lokal serta independent reviewers. Ketika reconciliation selesai lanjutkan task graph, bukan restart proyek dari kosong lagi. Laporkan pekerjaan yang dipertahankan, perubahan, tests, konflik dan blockers.

Gunakan MASTER-SOT.md sebagai authority, docs/39-discussion-ledger.md sebagai daftar keputusan superseded. Target0.1.0; import requirement baru tanpa overlay kit lama. Preserve code changes dan Git history, lakukan diff terarah, bukan unzip overwrite. Integrasikan doc37/T41 dan exactversion T42, lalu rerun full impacted gates.

Untuk koreksi edisi 1.1, terapkan diff developer-meaning secara terarah. Jangan overwrite working tree, menghapus code, mengulang foundation publisher, mereset task/evidence, atau mengubah versi npm. Sinkronkan master §7/§16, docs03/09/22, AGENTS, acceptance T04/T06/T23/T25 dan S65–S67. Bukti terdampak wajib dijalankan ulang; perubahan dokumen bukan bukti SDK telah diimplementasikan.

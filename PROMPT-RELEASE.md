# Prompt release controller — setelah implementasi dan ready evidence

Baca AGENTS.md, docs/18-release-migration.md dan candidate source/artifact/evidence identities. Jalankan actual product CI dan ready gate. Tidak ada publish/deploy jika required evidence gagal/absen; lakukan independent review dan perbaikan dahulu. Jangan memakai validate_all.py sebagai bukti production-ready.

Verifikasi repo/remotes, namespace, unused versions, exact supported model/protocol/browser matrix, existing GitOps path dan rollback image. Build once, pack exact reviewed artifacts, scan/inspect licenses/types/CSS/browser-server dependency, test external consumers. Gunakan unique RC next; multi-package publish tidak atomic. Rehearse staging rollback sebelum stable promotion.

Publish new unused 0.1.0 dengan credential lokal/CI yang sah, bukan overwrite/unpublish 0.2.0. Promosikan immutable image melalui deployment yang sudah ada, validasi routes/cache/asset coherence/imports/browser behavior. Setelah live baru record S52/T37 and release evidence. Jika write/auth/token/human gate tidak ada, laporkan blocker; jangan bypass confirmation atau menyatakan berhasil.

OSS/runtime/catalog lengkap tetap Apache-2.0. Commercial code/control plane terpisah. Laporan final berisi source commit, npm exact versions/integrity, image digest, actual live checks, rollback reference dan residual supported limitations.

Target owner terbaru adalah 0.1.0, bukan0.10. Jalankan T42: verify setiap name/version, namespace authority, pernahpublishedcollision, downgrade from highersemver, exact artifact tags. Jangan publish otomatis ke latest saat staging. Bila0.1.0 tidak tersedia, block exact publication dan laporkan; tidak mengubah versi/nama diam-diam. Tidak ada unpublish sebagai reset, tidak menghapus legacy live sebelum replacement+rollback. Ikuti docs/18-release-migration.md yang baru.

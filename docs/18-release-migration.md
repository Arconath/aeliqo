# 18 — Rewrite bersih, reset versi 0.1.0, dan cutover

Versi produk yang diminta pemilik sekarang **0.1.0**. Ini menggantikan target 0.10.0 pada kit sebelumnya, bukan mengubah nomor dokumen wire atau memalsukan riwayat rilis. Master ini bukan implementation/release 0.1.0 yang sudah selesai.

## Arti hapus existing

Seluruh source implementation lama boleh diganti dalam tree rewrite yang bersih. Tidak diperlukan mempertahankan compatibility internal kode PoC. Namun Git history, old release tags/artifacts, npm consumer, database aplikasi, credential, serta rollback production tidak dihapus otomatis.

`publish_git.py` membangun tree dari kit ini saja dan membuat satu commit baru dengan parent historical main, pada branch baru `rewrite/v0.1.0-master-foundation`. Source runtime lama tidak masuk tree itu. Default main/live tidak diubah oleh foundation publisher. Bukan `git reset --hard`, `git clean -fd`, force-push existing ref, atau recursive delete terhadap folder pengguna.

Pada cutover setelah candidate lolos: ganti deployment aktif melalui mekanisme deployment yang benar-benar ditemukan. Hapus workload/aset lama yang tidak lagi dipakai melalui daftar target eksplisit, setelah rollback reference diamankan. Jangan menghapus namespace, database, volume, registry image atau infrastruktur bersama hanya karena namanya mirip. Penghapusan production yang tidak teridentifikasi tetap blocked, bukan ditebak.

## Npm bukan Git working tree

Registry name+version yang pernah dipublikasikan tidak dapat ditimpa/digunakan ulang, termasuk setelah unpublish. `0.1.0` lebih kecil secara semver daripada `0.2.0` atau `0.10.0`. Latest adalah dist-tag yang dapat diarahkan secara eksplisit; range consumer yang meminta versi lain tidak otomatis turun ke rewrite. Lihat V09–V11 dalam research terkini.

Preflight setiap nama paket publik: namespace authority, semua available versions, dist-tags, deprecation, compatibility target, dan apakah `0.1.0` pernah terpakai. Absence dari daftar versions saja tidak membuktikan tidak pernah terpakai karena unpublish historical mungkin tidak tampil. Percobaan publish yang sah tetap dapat ditolak registry. Kegagalan jaringan bukan bukti nama/versi kosong.

Jika name@0.1.0 tersedia dan publish diizinkan, rilis unique RC `0.1.0-rc.N` ke tag `next`, lalu stable `0.1.0`. Publish stable awal menggunakan tag staging/rewrite yang tidak otomatis menggeser `latest`. Setelah semua exact tarball consumers lulus dan reset diterangkan, promotion dist-tag dilakukan eksplisit. Jangan diam-diam mengganti versi target saat collision; laporkan nama yang terpakai, lanjutkan semua pekerjaan lain, dan perlukan keputusan pemilik untuk nama package/namespace alternatif. Menghapus version lama bukan solusi collision.

Read-only registry reconnaissance on 10 September 2026 found that `@aeliqo/core` and `@aeliqo/react` carried an incompatible 0.2.0 preview lineage, while `@aeliqo/runtime`, `@aeliqo/web`, `@aeliqo/agent`, and `@aeliqo/devtools` were not visible. The owner subsequently chose the concise six-name family explicitly. The rewrite therefore uses `@aeliqo/core`, `@aeliqo/runtime`, `@aeliqo/web`, `@aeliqo/react`, `@aeliqo/agent`, and `@aeliqo/devtools`. A lower 0.1.0 line is an intentional reset and `latest` moves only after the exact stable set passes registry smoke.

An earlier bootstrap attempt published only `@aeliqo/sdk-core@0.1.0-rc.1` before the owner corrected the naming decision. The owner then manually unpublished every package in the npm organization, including the legacy 0.2.0 packages and that wrong-name RC. The deleted name+version pairs remain permanently unavailable, and complete package unpublication imposes npm's 24-hour name hold. The direct-name release must wait out that hold and recheck the registry; a later 404 is not evidence that those historical versions never existed. No `sdk-*` package is part of the supported release.

Version reset memerlukan migration guide eksplisit: API lama tidak kompatibel, import paths/protocol package berubah, major-zero range berbeda, saved workspace migration bisa unsupported, pin dependency exact yang didokumentasikan, dan cara kembali ke versi lama. Reset angka bukan bukti API stabil atau aman untuk upgrade otomatis.

## Package dan license

Target enam package publik adalah `@aeliqo/core`, `@aeliqo/runtime`, `@aeliqo/web`, `@aeliqo/react`, `@aeliqo/agent`, dan `@aeliqo/devtools`. Semua version target 0.1.0; exact internal dependency versions. Protocols menjadi subpaths agent. `@aeliqo/testkit` tetap source Apache-2.0, tetapi adalah workspace internal `private: true`: ia tidak dipreflight, dipublish sebagai RC/stable, atau dihitung dalam claim paket publik. Local security tests boleh mem-pack testkit untuk membuktikan boundary internalnya; artefak itu bukan artefak rilis. Nama package lama tidak diberi forwarding shim yang mengklaim compatibility palsu. Existing installed, cached, or deployed consumers may retain their lawfully obtained artifacts, but fresh registry installation of the owner-unpublished versions is unavailable. Deprecation is attempted only for an exact version that remains visible, after the migration notice and replacements are public and authenticated owner authority is active.

Apache-2.0 berlaku untuk seluruh runtime/catalog/komponen/agent/local Studio dan source testkit internal. Jaga NOTICE untuk enam package publik, licenses dependency dan contribution policy. Existing license grants tidak dibatalkan oleh reset repository. Commercial control plane private tidak disisipkan dalam public tree.

## Release gates dan staged publication

Bangun enam artefak publik dari source SHA tertentu, exact locked dependencies, reviewed tarballs, declarations/CSS/exports, SBOM dan immutable site image. Test consumer di luar monorepo menggunakan tarball publik yang sama. Penuhi contract/query/runtime/browser/a11y/manual/model/performance gates. Test mocks tidak boleh menjadi native/provider evidence.

Npm beberapa package dan website tidak satu transaksi atomik. Publisher mencatat package yang berhasil bila terhenti; lanjut hanya untuk nama/versi yang belum terbit, jangan mengganti bytes pada version sama. Build semua lebih dahulu, publish dependency order ke tag nonlatest, verifikasi full set, lalu promote secara terkoordinasi. CI actions pinned dan npm trusted publishing hanya bila konfigurasi account/runner sudah diverifikasi. Tidak ada credential yang dibuat atau diambil dari browser tanpa otorisasi.

Enam nama langsung harus tersedia sebelum npm trusted publishing dapat dikonfigurasi. Owner npm `arconath`, dari terminal lokal interaktif dengan mode 2FA `auth-and-writes`, membangun exact `0.1.0-rc.1` memakai `pnpm release:bootstrap:build`, meninjau manifest/tarball, lalu menjalankan `pnpm release:bootstrap:publish`. Jalur ini hanya menerima kandidat bersih pada HEAD saat ini, keenam identity dalam dependency order, tag `next`, byte/integrity yang sama, dan preflight pasca-hold yang menemukan identity absent atau exact history/resume state yang diizinkan. Jika npm otomatis membuat `latest` untuk first publication, publisher harus menghapus hanya tag prerelease yang baru dibuat itu dan memverifikasi `next` sebelum melanjutkan. Jalur bootstrap mewariskan stdio agar prompt passkey/OTP tetap lokal dan sengaja tidak mengklaim provenance cloud. Ia menolak CI, actor/org non-owner, riwayat package lain, tag rollback, dan semua versi lain.

Setelah keenam package ada, konfigurasi trusted publisher untuk setiap package ke repository `Arconath/aeliqo` dan workflow `release-publish.yml`. RC berikutnya harus unik (`0.1.0-rc.2` atau lebih tinggi), dipublish lewat workflow owner-dispatched dari current `main`, dan lulus verifikasi provenance npm yang mengikat tarball ke source SHA serta workflow tersebut. Stable tidak menerima bootstrap RC sebagai predecessor: input stable menunjuk successful RC workflow run, source SHA, candidate integrities, publication record, registry consumer, dan provenance yang sama. Jangan menaruh token atau OTP dalam argument, log, artifact, atau workflow.

## Deployment reconnaissance

Baca workflow, image registry, GitOps/deploy repository, origin/edge, cache headers, secrets references, healthcheck, version endpoint, dan rollback. Jangan menyimpulkan topology dari memory Proxmox/Kubernetes/VPS. Preview menggunakan port/namespace terpisah; tidak mematikan service existing untuk mengambil port.

Tampilan website versi lama tetap aktif selama replacement belum siap. Staging memakai source/package identity yang sama. Uji restore immutable image sebelumnya sebelum promotion. Asset names/cache harus mencegah HTML lama mengambil JS baru yang inkompatibel; audit service worker bila ada.

## Promotion dan laporan

Urutan: source complete -> test exact artifacts -> RC registry consumer -> staging browser -> rollback rehearsal -> stable exact packages -> explicit dist-tag decision -> production image promotion -> live smoke/identity -> release notes. Ready, published, deployed dan externally verified adalah state berbeda.

Tidak ada deployment/npm/GitHub write yang berhasil dilakukan oleh proses penyusunan master ini. GitHub main berhasil dibaca, create_tree kembali ditolak 403. Metadata observasi ada di validation/preparation-observations.json. Publisher lokal tersedia untuk credential pengguna; authenticated write path masih membutuhkan eksekusi nyata.

## Offline inventory helper

`scripts/version_preflight.py` checks a supplied normalized inventory, without making network calls or publishing. It rejects used/unknown0.1.0identity, unknown namespace rights, missing lower-semver migration and latest-as-staging. Its accepted status is candidate-inventory-accepted, never publishReady. Actual registry evidence and authenticated release rights remain required; a user-edited inventory is not a registry attestation.

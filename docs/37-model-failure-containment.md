# 37 — Kegagalan model, validasi, dan batas jaminan

Status: kontrak normatif target 0.1.0; reference tests bukan implementasi SDK. Bab ini menutup diskusi model lemah tanpa mempersempit kemampuan reasoning AI. Rujukan primer: V01 (Structured Outputs), V02 (OWASP), V03 (MCP), dalam `docs/40-current-research.md`.

## Prinsip yang tepat

**AI boleh salah. Aeliqo wajib menegakkan kontrak yang dapat diperiksa sebelum menerima efeknya.** Ini bukan janji bahwa setiap jawaban, interpretasi, atau tampilan pasti benar. Model yang memilih metric sah tetapi keliru menafsirkan pengguna dapat lolos validasi struktur. Catalog yang salah, executor yang bug, dan renderer yang belum diuji juga bisa menghasilkan kesalahan. Typecheck, approval, determinism, evidence link, dan zero observed failures bukan pembuktian kebenaran universal.

Tujuan graceful degradation: mempertahankan hasil valid yang masih diizinkan, menolak efek terlarang, meminta pilihan saat perbedaan meaning material, membatasi biaya, serta menyediakan kontrol manual. Jangan menurunkan kualitas menjadi data rekaan, missing value yang diganti nol, arbitrary UI, atau warning yang menyamarkan eksekusi gagal sebagai sukses.

Slogan lama “AI reasons; Aeliqo proves” diganti dengan **AI proposes; Aeliqo checks declared contracts and executes accepted plans.** Kata proof hanya dipakai untuk invariant yang benar-benar diperiksa dengan asumsi tertera. Model quality memengaruhi task success, bukan hak akses. Tidak ada model yang dianggap trusted karena namanya, harganya, atau effort-nya tinggi.

## Tiga kelas kegagalan

| Kelas | Contoh | Respons yang diwajibkan |
|---|---|---|
| Invalid yang dapat diperiksa | Field tidak ada, renderer tidak terdaftar, denominator policy hilang, scope salah, operator tidak didukung | Tolak sebelum efek; diagnostic ringkas dan alternatif sah. |
| Valid tetapi ambigu/salah maksud | `absence_rate` sah, tetapi pengguna bermaksud `unexcused_absence_rate` | Clarify bila ambiguitas diketahui dan material; gunakan default hanya bila host mendefinisikannya dan scope terlihat. Satu ID valid tidak membuktikan maksud user. |
| Interpretasi/narasi tidak terbukti | Angka benar, tetapi AI menyimpulkan sebab, motif, atau seluruh kelompok memburuk | Pisahkan computed fact, inference, dan hypothesis; numeric claims terikat nilai hasil; narasi belum didukung dilabeli atau tidak dipublikasikan. |

Binder tidak bisa membaca pikiran. Kandidat yang dipilih model bukan daftar lengkap kemungkinan. Discovery harus bisa mencari descriptor alternatif secara lazy; `one exact match` hanya bukti kecocokan katalog yang ditemukan, bukan kepastian semantik pengguna. Negasi, periode, cohort, unit, dan kebutuhan perbandingan dari user harus dipertahankan dalam Task beserta asal interpretasinya. Constraint yang diekstrak LLM tetap dapat salah; jangan memberinya provenance “human-confirmed” tanpa tindakan manusia yang nyata.

## Proposal boundary dan state

Nama implementasi dapat mengikuti schema generator, tetapi hasil operasional harus membedakan:

- `bound`: seluruh precondition yang dinyatakan terpenuhi; belum ada query atau perubahan UI.
- `needs-choice`: ada interpretasi alternatif yang material; tampilkan pilihan dengan akibatnya.
- `needs-meaning`: data/capability ada, tetapi definisi bisnis belum ada atau belum aktif dalam scope ini.
- `unsupported`: kontrak atau executor tidak mendukung operasi; jangan menebak bahwa datanya tidak ada.
- `denied`: efek tidak diizinkan; jangan bocorkan nama field atau record tersembunyi.
- `invalid`: bentuk payload, tipe, reference, version, atau invariant lokal tidak sah.
- `stale`: proposal/read set tidak lagi cocok dengan task/policy/result/profile yang aktif.

Cancelled, transport failure, budget exhaustion, dan search exhaustion merupakan state execution/planning terpisah, bukan sinonim semantic ambiguity. Result binder harus bisa diuji tanpa provider dan tanpa DOM. Payload wire dibatasi ukuran, kedalaman, jumlah operator, dan daftar field sebelum validasi mahal.

Tahapan: shape validation -> authenticated scope/operation grant -> catalog/reference/meaning binding -> semantic/capability validation -> plan negotiation -> execute -> result validation -> presentation feasibility -> recheck read set -> commit. Ordering aktual boleh mengutamakan penolakan murah dan redaksi, tetapi tidak boleh melakukan side effect sebelum semua izin/precondition yang relevan terpenuhi.

## Authority berbasis efek, bukan tangga model

Istilah observe/suggest/compose/act hanya boleh menjadi preset UX yang terurai ke grants, bukan hierarki otomatis. Grant tidak diwariskan hanya karena grant lain tersedia.

| Grant | Membolehkan | Tidak otomatis membolehkan |
|---|---|---|
| catalog.read | Membaca descriptor terotorisasi | Membaca records atau mengirimnya ke provider |
| result.inspect | Membaca hasil yang diizinkan | Egress ke model eksternal |
| task.propose | Membuat draft Task | Query execution |
| task.evaluate | Read query dalam budget | UI commit atau write bisnis |
| experience.propose | Kandidat registered graph | Mutation region |
| experience.commit | Commit yang lolos profile/read set | Mengubah app shell atau database |
| meaning.propose | Draft definisi | Aktivasi shared meaning |
| meaning.activate | Aktivasi scope yang diotorisasi | Aktivasi organization ketika grant hanya session |
| action.propose | Draft aksi aplikasi | Eksekusi tanpa confirmation |
| action.execute | Eksekusi aksi yang diizinkan | Menghapus confirmation/domain revision requirements |
| model.egress | Mengirim subset data sesuai policy | Akses raw data tambahan |

Effective capability adalah irisan principal permissions, region policy, source capability, model-egress policy, action confirmation, dan resource budget. Host menetapkan actor/grants; model tidak dapat mengirim `actor: human`, `approved: true`, atau model label untuk menaikkan hak. Trusted event dari UI juga harus melalui validasi; DOM event bukan credential server.

Model yang lolos eval tidak otomatis memperoleh `action.execute`. Host memilih grant sesuai risiko. Paket tidak mengandung entitlement model yang memberi safety lebih longgar kepada provider mahal. Kebijakan tidak boleh mencampur model inference kualitas dengan authentication.

## Fallback tanpa kehilangan smartness

Invalid proposal: satu diagnostic terstruktur; repair terbatas; jika berulang hentikan loop dan tampilkan manual controls. Unknown renderer: tolak kandidat; gunakan kandidat deterministik yang memenuhi Task, bukan arbitrary HTML. Model offline: region dan direct components tetap bekerja; query sumber mungkin tetap memerlukan network, sehingga “tanpa AI” bukan janji “semua data offline”.

Saat hasil lama masih sah, pertahankan dengan indikator scope/freshness. Jika permission dicabut, hasil lama harus dilepas; fallback tidak boleh mempertahankan data yang kini terlarang. Bila seluruh kandidat melanggar constraint, tampilkan conflict dan pilihan pengguna, bukan drop field atau ubah metric secara diam-diam.

Suboptimal-but-valid UI masih dapat gagal usability. Jangan mengklaim degraded UX selalu aman atau nyaman; ukur completion, error, unnecessary clarification, view churn, recovery dan latency. Bila UI tidak memenuhi task operations, kandidat invalid walaupun semua elemen merender.

## Loop reasoning yang terkendali

Setiap goal mempunyai budget turn, waktu, token/model cost, source query, scanned/transferred bytes, dan jumlah commit. Runtime mencatat query fingerprint dari normalized accepted plan + authorization/snapshot/definition scope. Model tidak boleh menentukan fingerprint sendiri untuk menghindari deteksi pengulangan.

Repeated identical query dengan source revision sama dapat memakai hasil/cached receipt. Jika source berubah atau pengguna secara eksplisit refresh, pengulangan mungkin sah. Bedakan repeated-query, no new information, transient retry, dan task refinement. Tidak semua dua query serupa merupakan loop. Gunakan observable progress (output baru, gap terjawab, scope berubah), bukan meminta private chain-of-thought.

Stop saat task selesai, dibatalkan, budget habis, denied, tidak ada kemajuan terukur, atau user memberi tujuan baru. In-flight lama tidak boleh commit setelah goal epoch berubah. Repair validator tidak boleh menghapus constraint agar lebih mudah lulus. Model yang repeatedly malformed boleh dinonaktifkan untuk session dengan alasan dan kontrol manual; provider fallback hanya jika aplikasi/user mengizinkan, tidak diam-diam memakai key/model lain.

## Narasi dan tampilan juga saluran halusinasi

Bukan hanya chat yang dapat mengarang. Title “Engineering paling buruk”, subtitle “data lengkap”, tooltip angka, label axis, badge “verified”, dan default filter juga merupakan klaim. Angka, unit, period, total, source, dan completeness yang dianggap faktual diisi dari Result/Catalog oleh formatter deterministik. Model boleh mengusulkan prose yang jelas dilabeli interpretasi dan tidak mengubah authoritative labels.

Claim reference minimal: output/result ID dan revision, metric/definition version, population/scope, period, evidence class, transform/method jika ada. Citation keberadaan saja tidak memverifikasi entailment. Structured numerical comparisons dapat diperiksa otomatis; klaim sebab/motif tidak menjadi fakta hanya karena menunjuk chart yang benar. High-impact narratives membutuhkan review yang ditetapkan aplikasi.

Free text classification/summarization boleh menjadi inference output dari host/model service dengan recipe/version/egress/uncertainty. Itu bukan field exact dan tidak diselundupkan ke pure formula AST. Menampilkan teks source sebagai teks ter-escape tidak membenarkan mengeksekusi instruksi yang tertulis di dalamnya.

## Evaluation untuk model lemah dan kuat

Uji transport/validator tanpa model menggunakan malformed/adversarial proposals. Lalu uji real models dengan budget yang diizinkan, repeated trials, holdout, bahasa Indonesia/Inggris, typo, negation, multi-turn references, dan catalog besar. Pisahkan transport compatibility dari reasoning quality. Simulasi model lemah bukan skor model nyata.

Tidak gunakan valid-tool-call rate sebagai task success. Ukur false accept, false reject, task correctness, grounded narrative, unsupported recognition, clarification burden, excessive reads/commits, recovery, latency dan biaya. Uji valid-but-wrong proposal sebagai residual-risk case; assertion yang benar adalah “validator tidak dapat membuktikan intended meaning dari payload ini”, bukan memaksa tes pass melalui tautologi.

Release wajib menunjukkan tidak ada pelanggaran hard invariant pada suite tertera. Zero observed failures tidak menjamin zero future risk. Jika model tidak dievaluasi, label `untested`/`limited`, bukan `supported` dengan angka palsu. Tidak ada proses “sertifikasi model” otomatis yang meningkatkan izin.

## Acceptance tambahan

AC-M01 unknown component/metric/function; AC-M02 forged actor/approval; AC-M03 two valid meanings materially differ; AC-M04 valid wrong meaning with no machine-readable contradiction; AC-M05 stale proposal and revoked permissions; AC-M06 hidden egress; AC-M07 model offline/manual path; AC-M08 duplicate queries with same and changed source versions; AC-M09 fake exact number in narrative/title; AC-M10 budget stop; AC-M11 high model label cannot elevate grants; AC-M12 same validation over direct/MCP/WebMCP/BYOK.

Reference implementation/test hanya membuktikan subset declared rules. Runtime validator, real provider, browser UI, backend auth, manual accessibility, dan task usability tetap gerbang produksi terpisah.

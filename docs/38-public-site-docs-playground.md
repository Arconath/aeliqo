# 38 — Website, docs, playground, dan pengalaman adopsi

Target: produk terlihat dan berperilaku sebagai framework UI yang matang, bukan dashboard AI generik. Semua halaman memakai Aeliqo design vocabulary, tetapi tidak wajib mengalokasikan agent atau Region runtime pada content statis. Sumber visual normatif adalah token, komponen aktual, serta design review; gambar generatif percakapan bukan spesifikasi kemampuan.

## Shell dan identitas

Lima jenis halaman: home `/`, docs `/docs/`, playground `/playground/`, blog `/blog/`, dan reusable content `/about/` atau `/legal/:slug`. Logo home di kiri; top navigation Docs, Playground, Blog; GitHub di kanan dan toggle system/light/dark. Home tidak memerlukan menu ganda “Landing Page”. Full-width shell tidak berarti paragraf sepanjang layar: reading column tetap terbatas, sementara playground memenuhi area kerja tersedia.

Gunakan logo Aeliqo yang benar-benar disetujui/tersedia di repository dengan provenance. Jangan memakai wordmark atau claims pada diagram generatif sebagai brand baru. Jika asset tidak tersedia, gunakan text wordmark netral sementara berlabel tugas asset, bukan logo baru yang diklaim approved.

Theme memakai surface netral, satu accent utama, semantic colors yang teruji, type scale konsisten, focus ring jelas, radius terbatas, dan spacing token. Tidak menambahkan gradient/glass/card nesting demi terlihat canggih. Motion membantu orientasi, tidak memperlambat kontrol; reduced-motion dan forced-colors mendapat treatment sendiri. Palette reference dalam design/ adalah baseline, bukan alasan melewati review layar nyata.

## Home

Hero menjawab tiga pertanyaan: Aeliqo apa, bagaimana dipasang, dan apa bedanya. Copy arah: “Build adaptive interfaces from application data and intent.” Subcopy memperjelas owned components, validated orchestration, AI optional untuk runtime, dan core agnostic. Hindari “any data, any UI, guaranteed safe, enterprise ready” sebelum bukti.

Dua primary paths: Get started ke quickstart sebenarnya, Open playground ke demonstrasi interaktif. Install command harus berasal dari release manifest yang benar dan memiliki fallback copy/error yang jelas. Jangan menampilkan contoh `<Metric /><Trend />` tanpa props dan memberi badge Live pada hasil hardcoded.

Satu demo utama: tabel records -> permintaan baru -> query/result -> tampilan 2D relevan, dengan jalur manual. Dataset sintetis diberi label. Preview harus memakai package built yang sama, bukan markup tiruan. Detail tool trace berada di disclosure. Tiga level produk dijelaskan dengan contoh nyata: primitive, semantic compound, adaptive region. Tampilkan batas dukungan renderer/model/protocol yang teruji; tidak butuh tabel marketing sangat panjang.

Bagian akhir: cara integrasi data sekali, cara author meaning melalui AI/manual, trust boundary yang jujur, OSS/license, dan dokumentasi. Social proof, customer logo, benchmark dan adoption count hanya bila nyata.

## Docs information architecture

Getting started: standalone, local records, HTTP application service, smart region, agent optional. Concepts: Catalog, Task, Result, Experience, queryless UI, meaning authoring, scope/grain/lineage. Components: per-entry URL, kategori, direct/semantic/region examples. Integration: vanilla, React, data server, MCP, BYOK, experimental WebMCP, extensions. Production: accessibility, performance, auth/egress, SSR/support matrix, version migration, troubleshooting. API reference generated dari declarations/schema yang sama.

Setiap example punya Preview/Code, dependencies, input fixture, expected result dan error state. Copy hanya source example yang relevan plus required setup, bukan seluruh module ribuan baris. Example diperiksa compile dan dijalankan dari package tarball di consumer luar monorepo. Sidebar item harus menuju route/anchor yang benar-benar ada, bukan banyak label menuju halaman yang sama tanpa target.

Search menyediakan keyboard shortcut, query state, hasil relevan, no-result, dan non-JS navigation fallback untuk content. Documentation version selector membedakan 0.1.0 rewrite dari versi npm historis. URLs stable; redirect lama hanya ketika maknanya setara, bukan menyembunyikan API break.

Setiap komponen: purpose, do/don't, props/defaults, controlled/uncontrolled, emitted events, public refs/parts/tokens, sizing/adaptation, loading/empty/partial/error, keyboard/AT, data semantics, performance boundary, recipe dan changelog. Accessibility tidak cukup satu badge AA tanpa evidence.

## Playground: hasil menjadi pusat

Default satu canvas utama dengan dataset/task chooser ringkas dan optional request bar. Source browser berada di panel yang bisa ditutup; inspector di kanan collapsed by default. Pada narrow screen gunakan drawer terfokus, bukan tiga kolom mengecil. Desktop side panes dapat di-resize melalui keyboard dan pointer; jangan biarkan minimum width membuat seluruh page scroll dua arah.

Header menunjukkan dataset, synthetic/real source status, scope dan mode. Agent status terdiri dari manual, MCP paired/unpaired, BYOK connected/unconfigured, WebMCP supported/unavailable/experimental. Model badge tidak mengklaim penalaran telah diuji. Key tidak disimpan di localStorage atau disisipkan dalam URL; BYOK memakai host backend reference.

Inspector mempunyai tabs Task, Data, Experience, Activity. Tampilkan accepted proposal, normalized query, scope/grain, result lineage, rejected candidates, budget, stages dan exact revision. Jangan menampilkan private chain-of-thought. Transcript singkat bukan source-of-truth; pilih view dapat dilakukan tanpa chat.

Flow demonstrasi wajib: list karyawan sebagai table; filter tim; define absence meaning bila belum tersedia; ranking; fixed-cohort trend; bandingkan periode; inspect contributor; ubah UI; resize; cancel query. Demo commerce menunjukkan browse/compare/detail/form, bukan analytics saja. Prompt baru harus diselesaikan lewat capability generik, bukan handler per kalimat.

Kesalahan model terlihat sebagai pesan yang dapat ditindaklanjuti: meaning belum ada, pilihan ambigu, query unsupported, biaya terlalu besar, stale proposal, atau provider gagal. Hasil lama hanya dipertahankan jika masih diizinkan dan dilabeli stale bila relevan. Retry tidak boleh memanggil provider berulang tanpa budget.

Save/export memakai versioned presentation/task document tanpa credential atau raw sensitive rows. Reset meminta konfirmasi bila akan menghapus draft lokal. Shared demo link tidak membawa token, transcript sensitif, atau data pribadi. Default demo ephemeral dijelaskan.

## Local Studio dan DevTools

Studio authoring di package devtools OSS, bukan login wajib website publik. Empat area: Data & Meaning, Experience, Gallery, Inspect. AI/manual adalah dua editor satu definition. Diff activation dan scope jelas; “AI suggested” tidak berubah menjadi “verified by Aeliqo” karena validator lulus.

Designer memakai pattern/token pilihan Aeliqo, bukan canvas bebas yang membuat domain-specific screen runtime baru. Preview matrix mencakup 320/360/768/1280px, light/dark, RTL, long labels, loading/empty/partial/stale/error, keyboard/IME/dirty draft, zoom/text scale. Simulasi tidak menggantikan AT review dan device nyata.

## Content pages dan blog

Blog index dengan satu featured post, daftar yang mudah dipindai, tag terbatas dan metadata tanggal sebenarnya. Article template reading column, code block scrollable, semantic headings, source references dan related article tanpa animasi berat. Jangan isi blog dengan berita atau success story fiktif.

Reusable footer content memakai satu layout sederhana untuk About, License, Security, Privacy dan Support. Privacy menjelaskan apakah website analytics, model egress, saved preferences dan telemetry terjadi. Komponen analytics/product runtime tidak diam-diam diaktifkan pada pengunjung docs.

## Production acceptance

Semua route, deep link, Back, 404, search, copy, theme persistence, mobile panels, keyboard focus dan form states diuji. Tidak ada console/hydration errors, layout shift tidak beralasan, mock preview berlabel live, atau incompatible cached JS chunks. Static content cepat dan dapat dibaca tanpa model; playground heavy modules lazy-loaded setelah dibutuhkan. Performa site dilaporkan whole-page, bukan hanya library bytes.

Artifact audit mengikat site ke package versions dan image digest. Satu desain konsisten sepanjang home/docs/playground/blog/content; komponen nyata menjadi visual proof framework. Pixel precision membutuhkan reviewed baselines per environment, tidak klaim bitmap universal. Rujukan V04–V08 dalam research terkini mendukung reflow, native interaction, visual testing dan page-performance principles.

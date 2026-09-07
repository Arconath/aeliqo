# 40 — Riset primer terkini dan batas inferensi

Tanggal pembacaan: **7 September 2026**. Semua URL berikut dibuka melalui web tool pada penyusunan master ini; ringkasan adalah implikasi desain, bukan klaim kinerja Aeliqo. Redirect/perbedaan versi masih harus diverifikasi pada implementation/release. Dokumen ini menjadi rujukan current di atas research registers historis.

| ID | Sumber primer | Implikasi / batas |
|---|---|---|
| V01 | [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | Schema-conforming output tetap dapat salah. Pisahkan syntax, meaning dan task evaluation. |
| V02 | [OWASP LLM Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) | Untrusted text dan excessive agency memerlukan pertahanan berlapis; system prompt bukan authorization. |
| V03 | [MCP specification](https://modelcontextprotocol.io/specification/latest) | Halaman latest redirect ke 2026-07-28 pada pemeriksaan ini. Pin/negotiate supported protocol; route protokol bukan reasoning model. |
| V04 | [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) | Ada pengecualian terbatas untuk bagian yang membutuhkan layout dua dimensi; bukan semua mobile menjadi cards. |
| V05 | [W3C WAI-ARIA patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) | Referensi behavior kontrol dan navigasi; mengikuti pattern tidak otomatis membuktikan full accessibility. |
| V06 | [Lit SSR](https://lit.dev/docs/ssr/overview/) | Lit SSR merupakan Labs experimental; production feasibility gate memeriksa integration dan limitations nyata. |
| V07 | [Web Vitals](https://web.dev/articles/vitals) | Whole-page field metrics berbeda dari library microbenchmark. Ukur keduanya dengan scope yang benar. |
| V08 | [Playwright snapshots](https://playwright.dev/docs/test-snapshots) | Visual baselines bergantung environment. Pin font/browser/OS/DPR dan review perbedaan. |
| V09 | [npm unpublish policy](https://docs.npmjs.com/policies/unpublish/) | Published name+version tidak bisa digunakan ulang setelah unpublish. Hapus bukan cara reset namespace history. |
| V10 | [npm dist-tag](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/) | Default install mengikuti latest tag. Promotion reset 0.1.0 harus disengaja, tidak implied semver upgrade. |
| V11 | [Semantic Versioning](https://semver.org/) | Urutan versi numerik tetap berlaku; product reset tidak membuat 0.1.0 lebih tinggi dari 0.2.0. |
| V12 | [OpenAPI specification](https://spec.openapis.org/oas/latest.html) | HTTP schema/operation description membantu tooling; tidak mengimplementasikan query atau business semantics. |
| V13 | [Standard Schema](https://standardschema.dev/) | Validation interoperability dibedakan dari JSON Schema/introspection. Importer perlu capability yang sesuai. |
| V14 | [Chrome WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api) | Dokumen memakai document.modelContext dan lifecycle registration/cancel. Support native harus diuji; masih berubah. |
| V15 | [Substrait specification](https://substrait.io/spec/specification/) | Prior art logical relational plans terpisah engine. Tidak mewajibkan Aeliqo mengadopsi seluruh format. |
| V16 | [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | Snapshot/isolation ditentukan backend. Multiquery Task tidak membuat snapshot global sendiri. |
| V17 | [Draco research](https://dig.cmu.edu/publications/2018-draco.html) | Hard/soft constraints untuk visualization design merupakan prior art, bukan jaminan optimal UX. |
| V18 | [Vega-Lite composition](https://vega.github.io/vega-lite/docs/composition.html) | Layer/facet/concat/repeat mendukung composability. Domain sharing perlu kesesuaian semantic. |
| V19 | [Lit React integration](https://lit.dev/docs/frameworks/react/) | React binding dapat membungkus shared web elements. Tetap uji properties/events/lifecycle/SSR. |
| V20 | [Optimize long tasks](https://web.dev/articles/optimize-long-tasks) | Yield/break long work supaya input responsif; worker bukan default untuk operasi kecil. |
| V21 | [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | Host enforcement permission berbeda dari frontend filter. Gunakan existing app authority. |
| V22 | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) | Sumber lisensi public kit; business packaging/trademark/contracts perlu review terpisah. |
| V23 | [A2UI overview](https://a2ui.org/concepts/overview/) | Agent-to-UI declarative architecture memiliki prior art. Aeliqo membuktikan owned semantics/query/adaptive task value, bukan klaim tanpa kompetitor. |
| V24 | [Tambo](https://tambo.co/) | Registered-component agent UI sudah ada. Perbandingan adoption/meaning/query/performance harus berbasis equivalent task. |
| V25 | [OpenAI subagents](https://developers.openai.com/codex/subagents) | Model/effort dan delegation tersedia menurut client. Pilihan pengguna Astra Medium/Luna Max tetap perlu actual local verification. |
| V26 | [OpenAI configuration reference](https://developers.openai.com/codex/config-reference) | Config keys bergantung versi. Generator tidak membuktikan konfigurasi efektif session; jangan copy key yang belum diverifikasi. |
| V27 | [OpenAI AGENTS.md](https://developers.openai.com/codex/guides/agents-md) | Instruction discovery hierarchical; gunakan root index singkat dan task docs progresif, bukan master penuh per agent. |
| V28 | [OpenAI harness engineering](https://openai.com/index/harness-engineering/) | Repository knowledge dan mechanical boundaries mendukung workflow agent. Tidak menggantikan actual tests dan review. |
| V29 | [Node release schedule](https://nodejs.org/en/about/previous-releases) | Gunakan supported LTS yang dipin dan diuji, bukan dependency patch yang diarang pada kit. |
| V30 | [DTCG format](https://www.designtokens.org/tr/2025.10/format/) | Token interchange community specification; Aeliqo Experience Profile bukan W3C Recommendation. |

## Temuan yang memengaruhi keputusan

Validasi output terstruktur bukan solusi total untuk hallucination; perubahan authority berdasarkan model quality tidak dibenarkan. Constraint-based selection dan declarative UI mempunyai prior art, sehingga novelty thesis Aeliqo adalah integrasi task-preserving dengan komponen lengkap sendiri, bukan mengaku menemukan semua mekanisme dasar.

Lit SSR tetap experimental menurut halaman yang dibaca; gate platform wajib sebelum katalog besar. Website source dapat stale terhadap feature terbaru sehingga pinned consumer evidence lebih tinggi daripada klaim compatibility generik. OpenAPI/Standard Schema membantu authoring, tidak menghilangkan implementation work data.

Target 0.1.0 perlu version-reset rollout. Tidak menghapus npm version lama untuk merebut ulang nama-version. GitHub write dicoba lagi dan ditolak 403. Registry container lookup gagal DNS; availability tidak ditentukan dari error tersebut.

Codex docs yang dibaca menampilkan subagent model/effort examples dan client controls, tetapi tidak membuktikan konfigurasi lokal pengguna. Nama display Astra/Luna berasal dari pilihan pengguna; harness memerlukan local model catalog dan actual spawn evidence sebelum menuliskan effective IDs. Tidak ada subagent yang dijalankan dalam sesi pembuatan kit ini.

## Yang diuji versus dirancang

Lihat VALIDATION.md untuk eksekusi harness/reference math/type/permission tests yang aktual. Runtime produk, DOM/SSR, real provider, manual AT, npm, deployment dan product-market fit tidak dibuktikan oleh research ini. Primary sources membenarkan tradeoff tertentu; comparative experiments diperlukan untuk menyatakan suatu pilihan lebih baik pada workload Aeliqo.

## Pertanyaan bisnis yang belum menjadi fakta

Siapa pembeli berulang, willingness-to-pay, biaya support enterprise dan diferensiasi yang menghasilkan retention harus diuji melalui pilot nyata. Framework universal di semua web adalah visi jangka panjang, bukan compatibility badge release awal. Keamanan/a11y tetap OSS meski managed organization services menjadi bisnis.

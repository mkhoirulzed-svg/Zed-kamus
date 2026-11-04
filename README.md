# ZAIDA Voice Nusantara

Prototype penerjemah bahasa Indonesia ke bahasa daerah dengan backend Cloudflare Workers dan Gemini API.

## Struktur
- `index.html`, `style.css`, `app.js`: frontend statis (GitHub Pages)
- `worker.js`: API Cloudflare Worker
- `wrangler.toml`: konfigurasi dasar Worker
- `manifest.webmanifest`, `sw.js`, `icon.svg`: dukungan PWA

## Deploy frontend
Hubungkan repository ke Cloudflare Pages atau GitHub Pages. Untuk Cloudflare Pages gunakan root directory `/`, build command kosong, output directory `/`.

Domain yang direncanakan: `voice.zaidalabs.com`.

## Deploy API di Cloudflare Workers
1. Buat Worker baru, misalnya `zaida-voice-nusantara-api`.
2. Deploy isi `worker.js` (atau hubungkan Git repository dan set entrypoint `worker.js`).
3. Tambahkan Worker secret bernama `GEMINI_API_KEY` melalui Settings → Variables and Secrets. Jangan pernah memasukkan API key ke file frontend atau repository.
4. Uji `GET https://NAMA-WORKER.workers.dev/api/health`.
5. Jika API memakai domain terpisah, ubah `API_BASE` di `app.js` menjadi URL Worker, lalu sesuaikan CORS agar hanya mengizinkan domain frontend.

## Endpoint
- `GET /api/health`
- `GET /api/languages`
- `POST /api/translate` body: `{"text":"Selamat pagi","source":"id","target":"nij"}`
- `POST /api/speak` (sengaja belum diaktifkan sampai dukungan TTS bahasa daerah terverifikasi)
- `POST /api/translate-speak`

## Catatan kualitas bahasa
Sepuluh bahasa pada prototipe berstatus `experimental`, bukan klaim dukungan resmi Gemini. Hasil terjemahan perlu diuji dan ditinjau penutur asli. Fitur TTS sengaja belum mengarang dukungan suara untuk bahasa yang belum terverifikasi.

## Gemini
Worker menggunakan Gemini Developer API melalui endpoint generateContent model `gemini-2.5-flash`. Periksa ketersediaan model dan kuota di Google AI Studio sebelum produksi.

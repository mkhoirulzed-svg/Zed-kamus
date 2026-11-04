# ZAIDA Voice Nusantara

Prototype penerjemah bahasa Indonesia ke bahasa daerah dengan backend Cloudflare Workers dan Gemini API.

## Struktur
- `index.html`, `style.css`, `app.js`: frontend statis untuk GitHub Pages
- `worker.js`: API Cloudflare Worker
- `wrangler.toml`: konfigurasi dasar Worker
- `manifest.webmanifest`, `sw.js`, `icon.svg`: dukungan PWA
- `CNAME`: domain GitHub Pages

## Domain
- Frontend: `https://voice.zaidalabs.com`
- API Worker: `https://api.voice.zaidalabs.com`

## Deploy frontend (GitHub Pages)
1. Buka Settings → Pages pada repository.
2. Pada Build and deployment pilih Deploy from a branch.
3. Pilih branch `main`, folder `/ (root)`, lalu Save.
4. File `CNAME` sudah disiapkan untuk `voice.zaidalabs.com`.
5. Di Cloudflare DNS, arahkan domain GitHub Pages sesuai instruksi GitHub Pages. Pastikan proxy DNS diset DNS only saat verifikasi sertifikat bila diperlukan.

## Deploy API di Cloudflare Workers
1. Buat Worker bernama `zaida-voice-nusantara-api`.
2. Deploy isi `worker.js` (atau hubungkan Git repository dan set entrypoint `worker.js`).
3. Tambahkan Worker secret bernama `GEMINI_API_KEY` melalui Settings → Variables and Secrets. Jangan pernah memasukkan API key ke file frontend atau repository.
4. Tambahkan custom domain `api.voice.zaidalabs.com` pada Worker (Settings → Domains & Routes).
5. Uji `GET https://api.voice.zaidalabs.com/api/health`. Respons harus berisi `ok: true` dan `configured: true`.

Frontend sudah diarahkan ke `https://api.voice.zaidalabs.com`. CORS Worker mengizinkan domain frontend `voice.zaidalabs.com` dan preview Cloudflare Pages.

## Endpoint
- `GET /api/health`
- `GET /api/languages`
- `POST /api/translate` body: `{"text":"Selamat pagi","source":"id","target":"nij"}`
- `POST /api/speak` (belum diaktifkan sampai dukungan TTS bahasa daerah terverifikasi)
- `POST /api/translate-speak`

## Catatan kualitas bahasa
Sepuluh bahasa pada prototipe berstatus `experimental`, bukan klaim dukungan resmi Gemini. Hasil terjemahan perlu diuji dan ditinjau penutur asli. Fitur TTS sengaja belum mengarang dukungan suara untuk bahasa yang belum terverifikasi.

## Gemini
Worker menggunakan Gemini Developer API melalui endpoint generateContent model `gemini-2.5-flash`. Periksa ketersediaan model dan kuota di Google AI Studio sebelum produksi.

# ZAIDA Voice Nusantara

Prototipe penerjemah bahasa Indonesia ke bahasa daerah dengan backend Cloudflare Workers dan OpenRouter.

## Struktur
- `index.html`, `style.css`, `app.js`: frontend statis untuk GitHub Pages
- `worker.js`: API Cloudflare Worker untuk terjemahan dan text-to-speech
- `wrangler.toml`: konfigurasi dasar Worker
- `manifest.webmanifest`, `sw.js`, `icon.svg`: dukungan PWA
- `CNAME`: domain GitHub Pages

## Domain
- Frontend: `https://voice.zaidalabs.com`
- API Worker: `https://api.voice.zaidalabs.com`

## Konfigurasi Cloudflare Workers

Tambahkan secret berikut pada Worker Settings → Variables and Secrets:

- `OPENROUTER_API_KEY` (wajib): API key dari OpenRouter.

Opsional, sebagai Worker Variables:
- `OPENROUTER_TRANSLATE_MODEL` (default: `qwen/qwen3-32b`)
- `OPENROUTER_TRANSLATE_FALLBACK_MODEL` (default: `google/gemini-3.8-flash`)
- `OPENROUTER_TTS_MODEL` (default: `google/gemini-3.8-flash-tts`)
- `OPENROUTER_TTS_FALLBACK_MODEL` (default: `google/gemini-3.8-flash-lite-tts`)

Jangan memasukkan API key ke frontend, GitHub, atau file konfigurasi yang dipublikasikan.

## Deploy frontend (GitHub Pages)
1. Buka Settings → Pages.
2. Pilih branch `main`, folder `/(root)`.
3. Pastikan DNS domain frontend mengarah ke GitHub Pages.

## Deploy API
1. Hubungkan repository ke Cloudflare Workers atau deploy `worker.js`.
2. Pastikan Worker bernama `zaida-voice-nusantara-api`.
3. Tambahkan secret `OPENROUTER_API_KEY`.
4. Tambahkan custom domain `api.voice.zaidalabs.com`.
5. Uji `GET https://api.voice.zaidalabs.com/api/health`. Respons harus menunjukkan `configured: true` dan provider `OpenRouter`.

## Endpoint
- `GET /api/health`
- `GET /api/languages`
- `POST /api/translate` body: `{"text":"Selamat pagi","source":"id","target":"nij"}`
- `POST /api/speak` body: `{"text":"...","language":"nij","voice":"Kore"}`
- `POST /api/translate-speak`

## Model dan kualitas bahasa
Model penerjemah dan TTS dapat diganti melalui Worker Variables tanpa mengubah frontend. Model default adalah kandidat awal, bukan klaim bahwa semua bahasa daerah sudah dikuasai dengan sempurna. Sepuluh bahasa masih berstatus experimental. Hasil perlu diuji dan ditinjau penutur asli, khususnya untuk kosakata, dialek, tingkat kesopanan, dan pelafalan.

TTS melalui OpenRouter menggunakan endpoint `/api/v1/audio/speech`. Dukungan suara dan format bergantung pada model yang dipilih. Periksa katalog OpenRouter sebelum mengganti model atau voice.

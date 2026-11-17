const API_BASE = "https://openrouter.ai/api/v1";

const LANGUAGES = [
  {id:"jv",name:"Jawa"},{id:"su",name:"Sunda"},{id:"ban",name:"Bali"},
  {id:"bjn",name:"Banjar"},{id:"bug",name:"Bugis"},{id:"ace",name:"Aceh"},
  {id:"min",name:"Minangkabau"},{id:"mad",name:"Madura"},
  {id:"bbc",name:"Batak Toba"},{id:"nij",name:"Dayak Ngaju"}
];

const TRANSLATE_MODEL = env => env.OPENROUTER_TRANSLATE_MODEL || "qwen/qwen3-32b";
const TRANSLATE_FALLBACK = env => env.OPENROUTER_TRANSLATE_FALLBACK_MODEL || "google/gemini-3.8-flash";
const TTS_MODEL = env => env.OPENROUTER_TTS_MODEL || "google/gemini-3.8-flash-tts";
const TTS_FALLBACK = env => env.OPENROUTER_TTS_FALLBACK_MODEL || "google/gemini-3.8-flash-lite-tts";

const allowedOrigin = origin =>
  ["https://voice.zaidalabs.com","https://kamus.zaidalabs.com"].includes(origin) ||
  /^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(origin || "");

const corsHeaders = request => {
  const origin = request.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin(origin) ? origin : "https://voice.zaidalabs.com",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
};

const json = (request,data,status=200) =>
  new Response(JSON.stringify(data), {
    status,
    headers:{...corsHeaders(request),"Content-Type":"application/json; charset=utf-8"}
  });

const errorMessage = (data,fallback) =>
  data?.error?.message || data?.message || fallback;

async function openRouterRequest(env,path,payload) {
  if (!env.OPENROUTER_API_KEY) {
    const error = new Error("API belum dikonfigurasi. Tambahkan secret OPENROUTER_API_KEY di Cloudflare Worker.");
    error.status = 503;
    throw error;
  }
  const response = await fetch(API_BASE + path, {
    method:"POST",
    headers:{
      "Authorization":"Bearer " + env.OPENROUTER_API_KEY,
      "Content-Type":"application/json",
      "HTTP-Referer":"https://voice.zaidalabs.com",
      "X-Title":"ZAIDA Voice Nusantara"
    },
    body:JSON.stringify(payload)
  });
  if (!response.ok) {
    const raw = await response.text();
    let detail = raw;
    try { detail = errorMessage(JSON.parse(raw),raw); } catch {}
    const error = new Error(detail || "Permintaan OpenRouter gagal.");
    error.status = response.status;
    throw error;
  }
  return response;
}

function extractText(content) {
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => typeof part === "string" ? part : (part?.text || "")).join("").trim();
  }
  return "";
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i=0; i<bytes.length; i+=chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i+chunkSize));
  }
  return btoa(binary);
}

export default {
  async fetch(request,env) {
    if (request.method === "OPTIONS") return new Response(null,{headers:corsHeaders(request)});
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json(request,{
        ok:true,
        service:"ZAIDA Voice Nusantara",
        configured:!!env.OPENROUTER_API_KEY,
        provider:"OpenRouter",
        models:{
          translate:TRANSLATE_MODEL(env),
          translateFallback:TRANSLATE_FALLBACK(env),
          tts:TTS_MODEL(env),
          ttsFallback:TTS_FALLBACK(env)
        }
      });
    }
    if (url.pathname === "/api/languages") return json(request,{languages:LANGUAGES.map(x=>({...x,status:"experimental"}))});
    if (request.method !== "POST") return json(request,{error:"Method tidak diizinkan."},405);

    let body;
    try { body = await request.json(); }
    catch { return json(request,{error:"Format JSON tidak valid."},400); }

    try {
      if (url.pathname === "/api/translate") return json(request,await translateData(body,env));
      if (url.pathname === "/api/speak") return json(request,await speakData(body,env));
      if (url.pathname === "/api/translate-speak") {
        const translated = await translateData(body,env);
        const audio = await speakData({text:translated.translation,language:body.target,voice:body.voice},env);
        return json(request,{translation:translated.translation,...audio});
      }
      return json(request,{error:"Endpoint tidak ditemukan."},404);
    } catch (error) {
      return json(request,{error:error.message || "Terjadi kesalahan pada layanan AI."},error.status || 502);
    }
  }
};

async function translateData(body,env) {
  const text = String(body.text || "").trim();
  const source = String(body.source || "id");
  const target = String(body.target || "");
  if (!text || text.length > 1200) {
    const error = new Error("Teks wajib diisi (maksimal 1.200 karakter)."); error.status=400; throw error;
  }
  const targetLanguage = LANGUAGES.find(x=>x.id===target);
  if (!targetLanguage) {
    const error = new Error("Bahasa tujuan belum tersedia."); error.status=400; throw error;
  }
  const sourceLanguage = source === "id" ? "Bahasa Indonesia" : LANGUAGES.find(x=>x.id===source)?.name;
  if (!sourceLanguage) {
    const error = new Error("Bahasa sumber belum tersedia."); error.status=400; throw error;
  }

  const systemPrompt = [
    "Anda adalah penerjemah profesional bahasa-bahasa Nusantara.",
    "Terjemahkan dengan setia, alami, dan sesuai pemakaian penutur asli.",
    "Jangan menerjemahkan secara harfiah jika hasilnya tidak alami.",
    "Pertahankan maksud, konteks, tingkat kesopanan, nama orang, angka, dan tanda baca.",
    "Jangan mencampur bahasa daerah lain.",
    "Jangan mengarang kosakata atau mengklaim kepastian jika tidak yakin.",
    "Jika ada beberapa ragam/dialek, gunakan ragam umum yang paling dikenal dan jangan menambahkan penjelasan.",
    "Keluarkan hanya hasil terjemahan, tanpa label, catatan, atau tanda kutip."
  ].join(" ");

  const userPrompt = "Terjemahkan dari " + sourceLanguage + " ke " + targetLanguage.name + ".\nTeks:\n" + text;
  const models = [TRANSLATE_MODEL(env),TRANSLATE_FALLBACK(env)].filter((v,i,a)=>v && a.indexOf(v)===i);
  let lastError;

  for (const model of models) {
    try {
      const response = await openRouterRequest(env,"/chat/completions",{
        model,
        messages:[
          {role:"system",content:systemPrompt},
          {role:"user",content:userPrompt}
        ],
        temperature:0.2,
        max_tokens:900
      });
      const data = await response.json();
      const translation = extractText(data?.choices?.[0]?.message?.content);
      if (!translation) throw new Error("Model tidak menghasilkan teks terjemahan.");
      return {translation,source,target,language:targetLanguage.name,model,provider:"OpenRouter"};
    } catch (error) {
      lastError = error;
      if (error.status && ![408,429,500,502,503,504].includes(error.status)) throw error;
    }
  }
  throw lastError || new Error("Semua model penerjemah gagal merespons.");
}

async function speakData(body,env) {
  const text = String(body.text || "").trim();
  const language = LANGUAGES.find(x=>x.id===body.language);
  const voice = String(body.voice || "Kore");
  const allowedVoices = ["Kore","Puck","Zephyr","Charon","Fenrir","Leda","Orus","Aoede"];
  if (!text || text.length > 1200) {
    const error = new Error("Teks audio wajib diisi (maksimal 1.200 karakter)."); error.status=400; throw error;
  }
  if (!language) {
    const error = new Error("Bahasa tidak dikenal."); error.status=400; throw error;
  }
  if (!allowedVoices.includes(voice)) {
    const error = new Error("Pilihan suara tidak tersedia."); error.status=400; throw error;
  }

  const models = [TTS_MODEL(env),TTS_FALLBACK(env)].filter((v,i,a)=>v && a.indexOf(v)===i);
  let lastError;
  for (const model of models) {
    try {
      const response = await openRouterRequest(env,"/audio/speech",{
        model,
        input:text,
        voice,
        response_format:"mp3",
        provider:{sort:"throughput"}
      });
      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim();
      if (!contentType.startsWith("audio/")) {
        const raw = await response.text();
        throw new Error("Respons TTS bukan audio: " + raw.slice(0,240));
      }
      const audioBase64 = arrayBufferToBase64(await response.arrayBuffer());
      if (!audioBase64) throw new Error("Model TTS mengembalikan audio kosong.");
      return {
        audioBase64,
        mimeType:contentType || "audio/mpeg",
        language:language.name,
        voice,
        model,
        provider:"OpenRouter"
      };
    } catch (error) {
      lastError = error;
      if (error.status && ![408,429,500,502,503,504].includes(error.status)) throw error;
    }
  }
  throw lastError || new Error("Semua model TTS gagal merespons.");
}

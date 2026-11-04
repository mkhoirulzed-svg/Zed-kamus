const allowedOrigin = origin => ["https://voice.zaidalabs.com","https://kamus.zaidalabs.com"].includes(origin) || /^https:\/\/[a-z0-9-]+\.pages\.dev$/.test(origin || "");
const corsHeaders = request => {const origin=request.headers.get("Origin")||"";return {"Access-Control-Allow-Origin":allowedOrigin(origin)?origin:"https://voice.zaidalabs.com","Vary":"Origin","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"}};
const json=(request,data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders(request),"Content-Type":"application/json; charset=utf-8"}});
const LANGUAGES = [
{id:"jv",name:"Jawa",status:"experimental"},{id:"su",name:"Sunda",status:"experimental"},{id:"ban",name:"Bali",status:"experimental"},{id:"bjn",name:"Banjar",status:"experimental"},{id:"bug",name:"Bugis",status:"experimental"},{id:"ace",name:"Aceh",status:"experimental"},{id:"min",name:"Minangkabau",status:"experimental"},{id:"mad",name:"Madura",status:"experimental"},{id:"bbc",name:"Batak Toba",status:"experimental"},{id:"nij",name:"Dayak Ngaju",status:"experimental"}
];
export default {async fetch(request,env){if(request.method==="OPTIONS")return new Response(null,{headers:corsHeaders(request)});const url=new URL(request.url);if(url.pathname==="/api/health")return json(request,{ok:true,service:"ZAIDA Voice Nusantara",configured:!!env.GEMINI_API_KEY});if(url.pathname==="/api/languages")return json(request,{languages:LANGUAGES});if(request.method!=="POST")return json(request,{error:"Method tidak diizinkan"},405);if(!env.GEMINI_API_KEY)return json(request,{error:"API belum dikonfigurasi. Tambahkan secret GEMINI_API_KEY di Cloudflare Worker."},503);
let body;try{body=await request.json()}catch{return json(request,{error:"Format JSON tidak valid"},400)}
if(url.pathname==="/api/translate"){const d=await translateData(body,env);return d.error?json(request,{error:d.error},d.status||500):json(request,d)}
if(url.pathname==="/api/speak"){const d=await speakData(body,env);return d.error?json(request,{error:d.error},d.status||500):json(request,d)}
if(url.pathname==="/api/translate-speak"){const translated=await translateData(body,env);if(translated.error)return json(request,{error:translated.error},translated.status||500);const audio=await speakData({text:translated.translation,language:body.target},env);if(audio.error)return json(request,{translation:translated.translation,error:audio.error},audio.status||500);return json(request,{translation:translated.translation,...audio})}
return json(request,{error:"Endpoint tidak ditemukan"},404)}};
async function translateData(body,env){
  const text=String(body.text||"").trim();
  const source=String(body.source||"id");
  const target=String(body.target||"");
  if(!text||text.length>1200)return {error:"Teks wajib diisi (maksimal 1.200 karakter).",status:400};
  const lang=LANGUAGES.find(x=>x.id===target);
  if(!lang)return {error:"Bahasa tujuan belum tersedia.",status:400};

  const sourceName=source==="id"?"Bahasa Indonesia":LANGUAGES.find(x=>x.id===source)?.name||"bahasa sumber";
  const prompt="Terjemahkan teks berikut dari "+sourceName+" ke bahasa "+lang.name+". Pertahankan makna, kesopanan, dan konteks. Jika tidak yakin dengan padanan lokal, jangan mengarang; berikan hasil paling mendekati secara alami. Keluarkan hanya teks terjemahan tanpa penjelasan. Teks: "+text;

  // Model utama dicoba lebih dahulu. Jika sedang overload, otomatis pindah ke model cadangan.
  const models=["gemini-3.8-flash","gemini-3.6-flash"];
  let lastError="Gemini gagal menerjemahkan.";
  let lastStatus=502;

  for(let i=0;i<models.length;i++){
    const model=models[i];
    try{
      const r=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
        body:JSON.stringify({
          model,
          input:prompt,
          generation_config:{thinking_level:"low",temperature:0.2,max_output_tokens:1024}
        })
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok){
        lastError=d.error?.message||"Gemini gagal menerjemahkan.";
        lastStatus=r.status;
        // Hanya pindah model untuk gangguan sementara/kapasitas server.
        if([500,502,503,504].includes(r.status)&&i<models.length-1)continue;
        return {error:lastError,status:lastStatus};
      }
      const translation=(d.steps||[])
        .filter(s=>s.type==="model_output")
        .flatMap(s=>s.content||[])
        .filter(p=>p.type==="text")
        .map(p=>p.text||"")
        .join("")
        .trim();
      if(!translation){
        lastError="Model tidak menghasilkan teks terjemahan.";
        lastStatus=502;
        if(i<models.length-1)continue;
        return {error:lastError,status:lastStatus};
      }
      return {translation,source,target,language:lang.name,model};
    }catch(e){
      lastError="Tidak dapat menghubungi layanan AI: "+String(e?.message||e);
      lastStatus=502;
      if(i<models.length-1)continue;
      return {error:lastError,status:lastStatus};
    }
  }
  return {error:lastError,status:lastStatus};
}
async function speakData(body,env){
  const text=String(body.text||"").trim();
  const language=LANGUAGES.find(x=>x.id===body.language);
  const voice=String(body.voice||"Kore");
  const allowedVoices=["Kore","Puck"];
  if(!text||text.length>1200)return {error:"Teks audio wajib diisi (maksimal 1.200 karakter).",status:400};
  if(!language)return {error:"Bahasa tidak dikenal.",status:400};
  if(!allowedVoices.includes(voice))return {error:"Pilihan suara tidak tersedia.",status:400};

  // Gemini TTS memakai generateContent, bukan Interactions API.
  const models=["gemini-3.8-flash-tts","gemini-3.8-flash-lite-tts"];
  let lastError="Gemini TTS gagal membuat audio.";
  let lastStatus=502;

  for(let i=0;i<models.length;i++){
    try{
      const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+models[i]+":generateContent",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
        body:JSON.stringify({
          contents:[{
            role:"user",
            parts:[{
              text:"Bacakan teks berikut dengan jelas dan alami dalam bahasa "+language.name+". Gunakan pelafalan bahasa daerah tersebut sejauh didukung. Bacakan hanya teks ini: "+text,
              speech_metadata:{style:"Speak naturally and clearly in "+language.name+". Warm, conversational delivery."}
            }]
          }],
          generationConfig:{
            responseModalities:["AUDIO"],
            speechConfig:{voiceConfig:{voice}}
          }
        })
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok){
        lastError=d.error?.message||"Gemini TTS gagal membuat audio.";
        lastStatus=r.status;
        if([429,500,502,503,504].includes(r.status)&&i<models.length-1)continue;
        return {error:lastError,status:lastStatus};
      }

      const parts=d.candidates?.[0]?.content?.parts||[];
      const audioPart=parts.find(p=>p.inlineData?.data);
      const audioBase64=audioPart?.inlineData?.data||"";
      if(!audioBase64){
        const textMessage=parts.filter(p=>p.text).map(p=>p.text).join(" ").trim();
        lastError=textMessage||"Gemini merespons, tetapi tidak menyertakan data audio. Periksa dukungan model dan konfigurasi TTS.";
        lastStatus=502;
        if(i<models.length-1)continue;
        return {error:lastError,status:lastStatus};
      }
      return {
        audioBase64,
        mimeType:audioPart.inlineData.mimeType||"audio/wav",
        language:language.name,
        voice,
        model:models[i]
      };
    }catch(e){
      lastError="Tidak dapat menghubungi layanan TTS: "+String(e?.message||e);
      lastStatus=502;
      if(i<models.length-1)continue;
      return {error:lastError,status:lastStatus};
    }
  }
  return {error:lastError,status:lastStatus};
}

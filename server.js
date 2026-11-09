import express from 'express';
import { createServer as createViteServer } from 'vite';
import { validSlides } from './src/deck.js';
const app = express();
app.use(express.json({limit:'32kb'}));
app.get('/api/status', (_req,res)=>res.json({ai: Boolean(process.env.AI_API_KEY || process.env.OPENAI_API_KEY)}));
app.post('/api/generate', async(req,res)=>{
  const {topic,audience,count}=req.body || {};
  if(typeof topic !== 'string' || !topic.trim() || topic.length>150 || typeof audience !== 'string' || !audience.trim() || audience.length>100 || !Number.isInteger(count) || count<3 || count>10) return res.status(400).json({error:'請填寫有效的主題、對象與頁數（3–10）。'});
  const key = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if(!key) return res.status(503).json({error:'尚未設定 AI 金鑰，請使用範本模式。'});
  try {
    const response=await fetch('https://api.openai.com/v1/chat/completions', {method:'POST',signal:AbortSignal.timeout(60000), headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}, body:JSON.stringify({model:process.env.AI_MODEL || 'gpt-4o-mini',response_format:{type:'json_object'},messages:[{role:'system',content:'你是繁體中文簡報編輯。回傳 JSON {"slides":[{"title":"標題","subtitle":"副標題","bullets":["重點"]}]}。每頁最多 4 點，每點簡短明確。不得捏造統計、引用或事實；不確定時標明待查證。遵守指定頁數。'},{role:'user',content:JSON.stringify({topic,audience,count})}]})});
    if(!response.ok) throw new Error('provider');
    const result=await response.json();
    const {slides}=JSON.parse(result.choices[0].message.content);
    if(!validSlides(slides,count)) throw new Error('format');
    res.json({slides});
  } catch {res.status(502).json({error:'AI 生成失敗，請稍後重試，或切換範本模式。'});}
});
if(process.env.NODE_ENV === 'production') app.use(express.static('dist'));
else app.use((await createViteServer({server:{middlewareMode:true}})).middlewares);
app.listen(Number(process.env.PORT || 5173),'0.0.0.0',()=>console.log('Slideform server ready'));

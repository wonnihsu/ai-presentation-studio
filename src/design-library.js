import {validImage} from './images.js';

export const defaultPreferences = '喜歡經過設計的光影、材質、色彩與字體構圖。接受透明幾何、虹彩折射、豐富植物細節、漸層疊色、非對稱文字與柔焦攝影。不限定黑底，希望能有明亮或有色背景。避免通用玻璃飄帶、缺乏脈絡的裝飾物、溫馨人物插畫。依不同方案選擇適合的手法，不將所有風格混在一起。';
export function safeSource(value='') {
  if(!value.trim())return '';
  try {const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
export function validReference(ref) {
  return ref && typeof ref.id==='string' && ref.id.length<=100 && typeof ref.title==='string' && ref.title.length<=150 && typeof ref.notes==='string' && ref.notes.length<=1500 && typeof ref.tags==='string' && ref.tags.length<=300 && typeof ref.source==='string' && ref.source.length<=2000 && (!ref.source || Boolean(safeSource(ref.source))) && validImage({data:ref.data,position:'right',fit:'contain'});
}
export function validateLibrary(value) {
  return value?.format==='slideform-library-v1' && typeof value.preferences==='string' && value.preferences.length<=4000 && Array.isArray(value.items) && value.items.length<=60 && value.items.every(validReference) && new Set(value.items.map(r=>r.id)).size===value.items.length;
}
export function makeDesignBrief({topic,brief,preferences,refs,count}) {
  if(![3,4,5].includes(count))throw Error('請選擇 3–5 個方案。');
  if(!refs.length)throw Error('請先選擇至少一張收藏圖片。');
  const schema={options:[{name:'方案名稱',concept:'設計概念與適合這個主題的原因',palette:['#F2EEE8','#173D49','#26A7B8'],composition:'標題與主視覺的位置、比例與留白',material:'具體材質與光影細節',typography:'字體層級與編排',motion:'動態方向；若是靜態稿也要清楚說明',imagePrompt:'可直接用於生圖的繁體中文完整提示詞，畫面不含文字，為可編輯標題留空間',referenceIds:[refs[0].id]}]};
  return `請根據我附上的「設計收藏參考板」製作 ${count} 個有明顯差異的簡報視覺方案。請實際觀察參考圖片，不要只根據文字猜測。如果未收到圖片，先請我附上參考板，不要聲稱已看過。\n主題：${topic}\n概述與目的：${brief}\n長期設計偏好：${preferences}\n本次參考（圖片依編號出現在參考板）：\n${refs.map((r,i)=>`${i+1}. ID=${r.id}；名稱=${r.title}；標籤=${r.tags}；我喜歡的原因=${r.notes}；來源=${r.source||'本機圖片'}`).join('\n')}\n每個方案必須說明借用哪些參考、如何回應主題、構圖、色彩、材質、字體與動態。不要照抄原圖或品牌標誌，不預設黑底，不只替同一張圖換顏色。不需要重寫簡報文案。\n先分析圖片，再將結果整理成以下 JSON 結構，options 恰好 ${count} 個，referenceIds 只能引用上列 ID，palette 使用 3–5 個六位 HEX 色碼。不要宣稱已產生圖片；這些是待選擇的設計提案。只輸出 JSON，以便我匯回網站：\n${JSON.stringify(schema,null,2)}`;
}
export function parseDesignOptions(text, refs) {
  let value;
  try{value=JSON.parse(text.trim().replace(/^```(?:json)?\s*\n/i,'').replace(/\n```\s*$/,''));}catch{throw Error('請貼上完整的方案 JSON，可包含 JSON 程式碼區塊。');}
  const ids=new Set(refs.map(r=>r.id));
  const keys=['name','concept','composition','material','typography','motion','imagePrompt'];
  if(!Array.isArray(value?.options) || value.options.length<3 || value.options.length>5)throw Error('需要 3–5 個方案。');
  for(const o of value.options){
    if(!o || (o.previewData!==undefined && !validImage({data:o.previewData,position:'right',fit:'contain'})) || !keys.every(k=>typeof o[k]==='string' && o[k].trim() && o[k].length<=(k==='imagePrompt'?6000:2000)) || !Array.isArray(o.palette) || o.palette.length<3 || o.palette.length>5 || !o.palette.every(c=>/^#[0-9a-f]{6}$/i.test(c)) || !Array.isArray(o.referenceIds) || !o.referenceIds.length || !o.referenceIds.every(id=>ids.has(id)))throw Error('方案格式或參考圖片 ID 不正確，請使用需求中的 JSON 格式。');
  }
  return value.options.map(o=>Object.fromEntries([...keys.map(k=>[k,o[k]]),['palette',o.palette],['referenceIds',o.referenceIds],...(o.previewData?[['previewData',o.previewData]]:[]) ]));
}

export function openLibraryDB(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('slideform-design-library',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('library');
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });
}
export async function readLibrary(){
 const db=await openLibraryDB();try{return await new Promise((resolve,reject)=>{const req=db.transaction('library').objectStore('library').get('current');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{db.close();}
}
export async function writeLibrary(value){
 const db=await openLibraryDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction('library','readwrite');tx.objectStore('library').put(value,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
}

export function makePreviewPrompt(options,topic){
 if(!Array.isArray(options)||options.length<3||options.length>5)throw Error('請先匯入 3–5 個方案。');
 return `請為「${topic}」製作一張設計方案比較板，內含 ${options.length} 張明顯不同、比例一致的簡報封面縮圖。每張加上清楚的方案編號 1–${options.length}，不加入其他文字或商標，預留可編輯標題空間。請依本對話已附的設計收藏參考板製作；若未收到參考板，請先要求我附上，不要猜測其內容。這是靜態設計稿，不能宣稱已完成動畫。請直接生成圖片，讓我比較構圖、材質與光影，而不是只提供文字描述。\n${options.map((o,i)=>`${i+1}. ${o.name}：${o.imagePrompt}`).join('\n')}`;
}

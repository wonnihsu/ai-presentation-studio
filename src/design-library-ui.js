import {readImage} from './images.js';
import {defaultPreferences,safeSource,validateLibrary,makeDesignBrief,makePreviewPrompt,parseDesignOptions,readLibrary,writeLibrary} from './design-library.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function mountDesignLibrary({getContext,onChoose,message}){
 const root=document.getElementById('design-library-root');
 let library={format:'slideform-library-v1',preferences:defaultPreferences,items:[],options:[]},selected=new Set(),filter='',working=false;
 root.innerHTML=`<details class="design-library panel" open><summary><span>設計收藏庫</span><small>收藏一次，供每份簡報選用</small></summary><div class="library-inner"><p class="library-description">放入你喜歡的圖片，記錄值得保留的設計。挑選參考後，一次製作參考板與需求，交給 ChatGPT 提出 3–5 個方案，再回來選擇。收藏與圖片留在此瀏覽器，不會上傳。</p><p class="library-storage" id="library-storage" role="status">正在讀取收藏…</p><div class="library-actions"><label class="library-upload" for="reference-files">＋ 加入收藏圖片</label><input hidden id="reference-files" type="file" accept="image/png,image/jpeg,image/webp" multiple><button type="button" id="library-backup">備份收藏庫</button><label class="library-upload" for="library-restore">開啟收藏庫</label><input hidden id="library-restore" type="file" accept="application/json,.json"></div><p class="hint">PNG／JPEG／WebP，每張最多 12 MB，最多 60 張。Pinterest 等網址可以附記在圖片上；僅有網址時無法自動讀取圖片。Mac／iCloud 備份請選「備份收藏庫」。</p><label for="design-preferences">我的長期設計偏好 <span>已依本次對話填入初稿，可修改</span></label><textarea id="design-preferences" maxlength="4000" rows="3"></textarea><div class="library-search"><input id="reference-search" type="search" placeholder="搜尋名稱、標籤或喜歡的原因" aria-label="搜尋收藏"><span id="reference-count"></span><button id="clear-selection" type="button">清除本次選取</button></div><div id="reference-grid" class="reference-grid"></div><div class="library-workflow"><div class="library-step"><h3>1. 帶出本次設計需求</h3><p>挑選 1–12 張收藏。參考板含圖片，需求含偏好與備註；兩者一起交給 ChatGPT，才有辦法看圖分析。</p><label for="design-option-count">希望比較幾個方案？</label><select id="design-option-count"><option value="3">3 個方案</option><option value="4">4 個方案</option><option value="5">5 個方案</option></select><div class="library-actions"><button type="button" id="download-reference-board">下載參考板 PNG</button><button type="button" id="make-design-brief">整理分析需求</button><button type="button" id="copy-design-brief">複製分析需求</button></div><label for="design-brief">交給 ChatGPT 的需求</label><textarea id="design-brief" rows="7" readonly></textarea><a href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">開啟 ChatGPT ↗</a><p class="hint">這一步由 ChatGPT 看圖提出方案；網站不會自行分析收藏或產生圖片，也不會讀取你的 ChatGPT 帳號。</p></div><div class="library-step"><h3>2. 比較並選擇設計方向</h3><p>貼回 ChatGPT 的方案 JSON，可比較構圖、材質、配色與生圖提示詞。方案卡片是提案說明，尚不是生成的封面圖片。</p><label for="design-options-input">貼上方案 JSON</label><textarea id="design-options-input" maxlength="100000" rows="7"></textarea><button id="import-design-options" type="button">匯入 3–5 個方案</button><p id="design-options-error" class="import-error" role="alert"></p></div></div><label for="design-preview-prompt">3. 產生視覺比較稿</label><p class="library-description">匯入方案後，複製下方提示詞交給 ChatGPT，產生一張包含所有方案的比較圖。也可把各方案的生成圖片加回卡片，方便長期比較。</p><button type="button" id="copy-preview-prompt" class="secondary">整理／複製方案比較生圖提示詞</button><textarea id="design-preview-prompt" rows="5" readonly aria-label="方案比較生圖提示詞"></textarea><div id="design-options-grid" class="design-options-grid"></div><p id="chosen-design" class="chosen-design" role="status"></p></div></details>`;
 const $=id=>document.getElementById(id);
 const status=text=>$('library-storage').textContent=text;
 async function persist(){try{await writeLibrary(library);status('● 收藏已儲存於此瀏覽器；清除網站資料前請備份。');}catch{status('本機自動儲存不可用，請用「備份收藏庫」保存；重新整理可能失去變更。');}}
 function selectedRefs(){return library.items.filter(r=>selected.has(r.id));}
 function clearOutput(){ $('design-brief').value=''; }
 function render(){
  const items=library.items.filter(r=>`${r.title} ${r.tags} ${r.notes}`.toLowerCase().includes(filter.toLowerCase()));
  $('reference-count').textContent=`${library.items.length} 張收藏 · 已選 ${selected.size} / 12`;
  $('reference-grid').innerHTML=items.length?items.map(r=>`<article class="reference-card ${selected.has(r.id)?'is-selected':''}" data-ref="${esc(r.id)}"><label class="reference-select"><input type="checkbox" data-select="${esc(r.id)}" ${selected.has(r.id)?'checked':''}>加入本次參考</label><img src="${r.data}" alt="${esc(r.title)}" loading="lazy"><label>名稱<input data-field="title" maxlength="150" value="${esc(r.title)}"></label><label>標籤<input data-field="tags" maxlength="300" value="${esc(r.tags)}" placeholder="如：折射、版式、留白"></label><label>我喜歡的原因<textarea data-field="notes" maxlength="1500" rows="3" placeholder="例如：喜歡紅色與透明材質的對比，不要照抄造型">${esc(r.notes)}</textarea></label><label>來源網址<input data-field="source" type="url" maxlength="2000" value="${esc(r.source)}" placeholder="可記錄 Pinterest 網址"></label><button type="button" data-delete="${esc(r.id)}">刪除收藏</button></article>`).join(''):`<div class="library-empty">${library.items.length?'找不到符合的收藏，請換個關鍵字。':'先把喜歡的設計圖片放進來。之後可跨簡報重複選用，不用重新收藏。'}</div>`;
 }
 function renderOptions(){
  $('design-options-grid').innerHTML=(library.options||[]).map((o,i)=>`<article class="design-option"><div class="option-number">方向 ${i+1}</div><h3>${esc(o.name)}</h3>${o.previewData?`<img class="option-preview" src="${o.previewData}" alt="${esc(o.name)} 的視覺預覽">`:'<div class="option-preview-empty">尚未加入視覺預覽圖</div>'}<label class="preview-upload">加入／更換方案預覽圖<input type="file" data-preview="${i}" accept="image/png,image/jpeg,image/webp"></label><div class="option-swatches">${o.palette.map(c=>`<span style="background:${c}" title="${c}"></span>`).join('')}</div><p>${esc(o.concept)}</p><dl>${[['composition','構圖'],['material','材質與光影'],['typography','字體編排'],['motion','動態方向']].map(([key,label])=>`<dt>${label}</dt><dd>${esc(o[key])}</dd>`).join('')}</dl><div class="option-references">${o.referenceIds.map(id=>{const ref=library.items.find(r=>r.id===id);return ref?`<img src="${ref.data}" alt="參考：${esc(ref.title)}" title="${esc(ref.title)}">`:'';}).join('')}</div><button type="button" data-choose="${i}">採用這個方向</button></article>`).join('');
 }
 try{const saved=await readLibrary();if(saved && validateLibrary(saved)){
  library=saved;
  try{library.options=saved.options?.length?parseDesignOptions(JSON.stringify({options:saved.options}),saved.items):[];}catch{library.options=[];}
 }status('● 收藏保存在此瀏覽器；建議備份到 Mac 或 iCloud Drive。');}catch{status('本機自動儲存不可用，請使用「備份收藏庫」保存。');}
 $('design-preferences').value=library.preferences;render();renderOptions();
 $('design-preferences').onchange=async()=>{library.preferences=$('design-preferences').value;clearOutput();await persist();};
 $('reference-search').oninput=e=>{filter=e.target.value;render();};
 $('clear-selection').onclick=()=>{selected.clear();clearOutput();render();};
 $('reference-grid').onchange=async e=>{
  const card=e.target.closest('[data-ref]');if(!card)return;
  const ref=library.items.find(r=>r.id===card.dataset.ref);if(!ref)return;
  if(e.target.dataset.select){if(e.target.checked){if(selected.size>=12){e.target.checked=false;message('每次最多選 12 張參考。');return;}selected.add(ref.id);}else selected.delete(ref.id);clearOutput();render();return;}
  const field=e.target.dataset.field;
  if(field){let value=e.target.value;if(field==='source' && value && !safeSource(value)){message('來源網址請使用完整的 http 或 https 網址。');e.target.value=ref.source;return;}ref[field]=value;clearOutput();await persist();}
 };
 $('reference-grid').onclick=async e=>{
  const id=e.target.dataset.delete;if(!id || !confirm('刪除此收藏？已存到簡報中的圖片不會受影響。'))return;
  library.items=library.items.filter(r=>r.id!==id);selected.delete(id);library.options=[];clearOutput();render();renderOptions();await persist();
 };
 $('reference-files').onchange=async e=>{
  if(working)return;working=true;e.target.disabled=true;let added=0;const failures=[];
  try{for(const file of [...e.target.files]){
   if(library.items.length>=60){failures.push('收藏已達 60 張上限');break;}
   try{const image=await readImage(file);const ref={id:crypto.randomUUID(),title:file.name.replace(/\.[^.]+$/,'').slice(0,150),data:image.data,tags:'',notes:'',source:''};library.items.push(ref);if(selected.size<12)selected.add(ref.id);added++;}catch(error){failures.push(`${file.name}：${error.message}`);}
  }clearOutput();render();await persist();message(`已加入 ${added} 張收藏。${failures.join('；')}`);}finally{working=false;e.target.disabled=false;e.target.value='';}
 };
 $('library-backup').onclick=()=>download(new Blob([JSON.stringify(library)],{type:'application/json'}),'slideform-設計收藏庫.json');
 $('library-restore').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{if(file.size>180*1024*1024)throw Error('收藏庫檔案超過 180 MB。');const value=JSON.parse(await file.text());if(!validateLibrary(value))throw Error('收藏庫格式不正確，請使用備份的收藏庫 JSON。');
   if(!confirm('開啟收藏庫會取代目前收藏，請先備份。確定繼續？'))return;
   let options=[];if(value.options?.length)options=parseDesignOptions(JSON.stringify({options:value.options}),value.items);
   library={format:'slideform-library-v1',preferences:value.preferences,items:value.items,options};selected.clear();filter='';$('reference-search').value='';$('design-preferences').value=library.preferences;clearOutput();render();renderOptions();await persist();message('收藏庫已開啟，可以選擇本次參考。');
  }catch(error){message(error instanceof SyntaxError?'無法讀取收藏庫 JSON。':error.message);}finally{e.target.value='';}
 };
 function prepareBrief(){const context=getContext();library.preferences=$('design-preferences').value;const refs=selectedRefs();$('design-brief').value=makeDesignBrief({...context,preferences:library.preferences,refs,count:Number($('design-option-count').value)});return refs;}
 $('make-design-brief').onclick=()=>{try{prepareBrief();message('需求已整理。請將參考板與需求一起交給 ChatGPT。');}catch(error){message(error.message);}};
 $('copy-design-brief').onclick=async()=>{try{prepareBrief();try{await navigator.clipboard.writeText($('design-brief').value);message('分析需求已複製。請記得附上參考板。');}catch{$('design-brief').focus();$('design-brief').select();message('請複製已選取的分析需求，並附上參考板。');}}catch(error){message(error.message);}};
 $('design-option-count').onchange=clearOutput;
 $('download-reference-board').onclick=async()=>{
  if(working)return;working=true;$('download-reference-board').disabled=true;
  try{
   const refs=prepareBrief(),cols=refs.length<5?2:3,cellW=760,cellH=620;
   const canvas=document.createElement('canvas');canvas.width=cols*cellW;canvas.height=130+Math.ceil(refs.length/cols)*cellH;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#f2f3f1';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#1a3045';ctx.font='bold 32px sans-serif';ctx.fillText('SLIDEFORM / DESIGN REFERENCES',28,50);ctx.font='22px sans-serif';ctx.fillText('依編號對照設計需求，分析圖片材質、配色與構圖',28,95);
   for(const [i,ref] of refs.entries()){
    const img=new Image();img.src=ref.data;await img.decode();const x=i%cols*cellW+24,y=130+Math.floor(i/cols)*cellH+14;
    ctx.fillStyle='#fff';ctx.fillRect(x,y,cellW-48,cellH-28);const scale=Math.min((cellW-80)/img.width,(cellH-130)/img.height);
    ctx.drawImage(img,x+(cellW-48-img.width*scale)/2,y+12,img.width*scale,img.height*scale);
    ctx.fillStyle='#1a3045';ctx.font='bold 24px sans-serif';ctx.fillText(`${i+1}. ${ref.title}`,x+16,y+cellH-79,cellW-80);ctx.font='17px sans-serif';ctx.fillText(ref.tags||'未標記',x+16,y+cellH-46,cellW-80);
   }
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('參考板產生失敗。');download(blob,'slideform-設計收藏參考板.png');message('參考板已下載。請連同分析需求交給 ChatGPT。');
  }catch(error){message(error.message||'參考板產生失敗。');}finally{working=false;$('download-reference-board').disabled=false;}
 };
 $('import-design-options').onclick=async()=>{try{const options=parseDesignOptions($('design-options-input').value,library.items);library.options=options;renderOptions();$('design-options-error').textContent='';await persist();message('方案已匯入，請比較後選擇方向。');}catch(error){$('design-options-error').textContent=error.message;}};
 $('design-options-grid').onclick=e=>{const index=e.target.dataset.choose;if(index===undefined)return;const option=library.options[Number(index)];if(!option)return;onChoose(option);$('chosen-design').textContent=`已採用「${option.name}」；生圖提示詞將沿用此方向。`;root.querySelectorAll('[data-choose]').forEach(b=>b.setAttribute('aria-pressed',b===e.target));message('已採用設計方向。可前往「本頁圖片」產生提示詞。');};

 $('copy-preview-prompt').onclick=async()=>{
  try{$('design-preview-prompt').value=makePreviewPrompt(library.options,getContext().topic);try{await navigator.clipboard.writeText($('design-preview-prompt').value);message('已複製，請交給 ChatGPT 生成比較圖。');}catch{$('design-preview-prompt').focus();$('design-preview-prompt').select();message('請複製已選取的比較圖生圖提示詞。');}}catch(error){message(error.message);}
 };
 $('design-options-grid').onchange=async e=>{
  const index=e.target.dataset.preview;if(index===undefined || !e.target.files[0])return;
  const option=library.options[Number(index)];e.target.disabled=true;
  try{const image=await readImage(e.target.files[0]);if(!library.options.includes(option))throw Error('方案已更換，請重新選圖。');option.previewData=image.data;await persist();renderOptions();message('方案預覽已加入，可與其他方向比較。');}catch(error){message(error.message);}finally{e.target.disabled=false;e.target.value='';}
 };
 return {getSelectedReferences:selectedRefs};
}

import {validImage} from './images.js';
export function makeDeck(topic, audience, count) {
  const sections = [
    ['為什麼現在值得關注', ['整理目前的背景與改變', '找出最需要解決的問題', `連結${audience}的實際需求`]],
    ['核心觀點', ['用一句話說明主要主張', '補上可查證的案例與資料', '釐清與現行做法的差異']],
    ['從想法到行動', ['選擇一個可執行的起點', '定義負責人與必要資源', '安排回顧時間與成功指標']],
    ['預期效益與限制', ['列出希望帶來的具體改善', '標記需要驗證的假設', '說明風險與可行的應對方式']],
    ['下一步', ['確認今天最重要的共識', '選定第一項行動', '邀請提問與討論']]
  ];
  return Array.from({length:count}, (_, i) => i === 0
    ? {title:topic, subtitle:`為${audience}準備的觀點與行動提案`, bullets:['背景洞察 · 核心觀點 · 行動計畫']}
    : {title:sections[(i-1)%sections.length][0], subtitle:`${topic} / ${audience}`, bullets:[...sections[(i-1)%sections.length][1]]});
}
export function validSlides(value, count) {
  return Array.isArray(value) && value.length === count && value.every(s => s && validImage(s.image) && typeof s.title === 'string' && s.title.length > 0 && s.title.length <= 200 && typeof s.subtitle === 'string' && s.subtitle.length <= 500 && Array.isArray(s.bullets) && s.bullets.length <= 6 && s.bullets.every(b=> typeof b === 'string' && b.length <= 500));
}

export function makePrompt(topic, audience, count, brief = '', style = '') {
  return `請為以下主題撰寫 ${count} 頁繁體中文簡報。\n主題：${topic}\n概述與目的：${brief}\n整體視覺方向：${style}\n先規劃故事順序、每頁目的，讓各頁形成完整敘事。\n聽眾：${audience}\n每頁標題最多 200 字、副標題最多 500 字、重點最多 6 點且每點最多 500 字。內容要具體，不捏造數據或引用，未確認的資訊標記待查證。\n請只輸出以下純文字格式，以單獨一行 --- 分隔每頁，不要加程式碼區塊或額外說明：\n# 第一頁標題\n> 副標題\n- 重點一\n- 重點二\n---\n# 第二頁標題\n> 副標題\n- 重點一\n（依此格式完成全部 ${count} 頁）`;
}

export function parseDeck(text) {
  if (typeof text !== 'string' || text.length > 40000) throw new Error('匯入內容最多 40,000 字。');
  const clean = text.trim().replace(/^```(?:markdown|md|text)?\s*\n/i, '').replace(/\n```\s*$/, '');
  const blocks = clean.split(/^\s*---\s*$/m).map(b=>b.trim()).filter(Boolean);
  if (blocks.length < 3 || blocks.length > 10) throw new Error('請匯入 3–10 頁，以單獨一行 --- 分隔每頁。');
  const slides = blocks.map((block, i) => {
    const lines = block.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if (!/^#\s+\S/.test(lines[0] || '')) throw new Error(`第 ${i+1} 頁需要以「# 標題」開頭。`);
    const title = lines.shift().replace(/^#\s+/, '');
    const subtitle = lines[0]?.startsWith('>') ? lines.shift().replace(/^>\s*/, '') : '';
    if (lines.some(l=>!/^[-*•]\s+\S/.test(l))) throw new Error(`第 ${i+1} 頁的每個重點請以「- 」開頭。`);
    return {title, subtitle, bullets:lines.map(l=>l.replace(/^[-*•]\s+/, ''))};
  });
  if (!validSlides(slides, slides.length)) throw new Error('標題最多 200 字、副標題最多 500 字；每頁最多 6 點，每點最多 500 字。');
  return slides;
}

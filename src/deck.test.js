import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeDeck,validSlides,makePrompt} from './deck.js';
test('範本產生指定頁數，保留使用者主題及對象',()=>{for(let n=3;n<=10;n++){const slides=makeDeck('永續設計','新創團隊',n);assert.equal(slides.length,n);assert.equal(slides[0].title,'永續設計');assert.match(slides[0].subtitle,/新創團隊/);assert.ok(validSlides(slides,n));}});
test('拒絕不完整、過多或過長的 AI 回傳內容',()=>{assert.equal(validSlides([{title:'缺少內容'}],1),false);assert.equal(validSlides(makeDeck('test','team',3),5),false);const slides=makeDeck('test','team',3);slides[1].bullets=['x'.repeat(501)];assert.equal(validSlides(slides,3),false);});

test('匯入 ChatGPT 文字，支援程式碼圍欄與 CRLF', async()=>{
 const {parseDeck,makePrompt}=await import('./deck.js');
 const text=Array.from({length:3},(_,i)=>`# 標題 ${i+1}\r\n> 說明\r\n- 重點一\r\n* 重點二`).join('\r\n---\r\n');
 const slides=parseDeck('```markdown\n'+text+'\n```');
 assert.equal(slides.length,3);assert.deepEqual(slides[1],{title:'標題 2',subtitle:'說明',bullets:['重點一','重點二']});
 assert.match(makePrompt('永續設計','學生',3),/永續設計/);
 assert.throws(()=>parseDeck('# 一頁'),/3–10/);
 assert.throws(()=>parseDeck(text.replace('- 重點一','無格式文字')),/重點/);
 assert.throws(()=>parseDeck(text.replace('標題 1','字'.repeat(201))),/200/);
});

test('草稿圖片只接受內嵌的 JPEG/PNG 與受支援的版面',async()=>{
 const {validImage,imagePrompt}=await import('./images.js');
 assert.equal(validImage(undefined),true);
 const image={data:'data:image/jpeg;base64,/9j/AA==',position:'left',fit:'contain'};
 assert.ok(validImage(image));
 for(const data of ['https://example.com/image.jpg','data:image/svg+xml;base64,AAA','data:image/png;base64,AAA" onerror="x'])assert.equal(Boolean(validImage({...image,data})),false);
 assert.equal(validImage({...image,position:'other'}),false);
 assert.equal(validImage({...image,data:'data:image/jpeg;base64,'+'a'.repeat(2800001)}),false);
 const slides=makeDeck('主題','團隊',3);slides[0].image=image;assert.ok(validSlides(slides,3));
 assert.match(imagePrompt(slides[0],'主題','水彩'),/水彩/);
 assert.match(makePrompt('主題','團隊',3,'目的是培訓','水彩'),/目的是培訓/);
});

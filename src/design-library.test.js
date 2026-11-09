import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeSource,validateLibrary,validReference,makeDesignBrief,parseDesignOptions} from './design-library.js';
const ref={id:'ref-1',title:'折射光影',tags:'折射、字體',notes:'喜歡光影參與排版',source:'https://www.pinterest.com/pin/example/',data:'data:image/jpeg;base64,/9j/AA=='};
const option={name:'光影構圖',concept:'概念',palette:['#FFFFFF','#193A4F','#25ABBB'],composition:'非對稱排版',material:'折射',typography:'大字',motion:'光線掠過',imagePrompt:'淺底折射，為文字留空間',referenceIds:['ref-1']};
test('收藏庫備份驗證保留圖片，拒絕危險來源與重複 ID',()=>{
 assert.ok(validReference(ref));assert.ok(validateLibrary({format:'slideform-library-v1',preferences:'偏好',items:[ref]}));
 assert.equal(safeSource('javascript:alert(1)'), '');
 assert.equal(safeSource('file:///etc/passwd'), '');
 assert.equal(Boolean(validReference({...ref,data:'https://example.com/image.jpg'})),false);
 assert.equal(validateLibrary({format:'slideform-library-v1',preferences:'',items:[ref,ref]}),false);
});
test('設計需求含所選圖片、偏好、主題與方案數，要求實際看圖',()=>{
 const prompt=makeDesignBrief({topic:'AI 工作流',brief:'培訓',preferences:'不要黑底',refs:[ref],count:5});
 for(const text of ['5 個','ref-1','不要黑底','AI 工作流','培訓','未收到圖片'])assert.ok(prompt.includes(text));
 assert.throws(()=>makeDesignBrief({refs:[],count:3}),/至少/);
});
test('可匯入 3–5 個方案，拒絕缺欄位、不安全配色與未知參考',()=>{
 const options=Array.from({length:3},(_,i)=>({...option,name:`方案 ${i}`}));
 assert.equal(parseDesignOptions('```json\n'+JSON.stringify({options})+'\n```',[ref]).length,3);
 assert.throws(()=>parseDesignOptions(JSON.stringify({options:[option]}),[ref]),/3–5/);
 assert.throws(()=>parseDesignOptions(JSON.stringify({options:options.map(o=>({...o,palette:['red','#fff','url(x)']}))}),[ref]),/格式/);
 assert.throws(()=>parseDesignOptions(JSON.stringify({options}),[]),/ID/);
});

test('方案預覽圖片可保存，錯誤格式不能混入備份',()=>{
 const options=Array.from({length:3},()=>({...option,previewData:ref.data}));
 assert.equal(parseDesignOptions(JSON.stringify({options}),[ref])[0].previewData,ref.data);
 assert.throws(()=>parseDesignOptions(JSON.stringify({options:options.map(o=>({...o,previewData:'https://example.com/a.png'}))}),[ref]),/格式/);
});

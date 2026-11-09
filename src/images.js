export const MAX_IMAGE_DATA = 2800000;
export function validImage(image) {
  return image === undefined || (image && typeof image.data === 'string' && image.data.length <= MAX_IMAGE_DATA && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.data) && ['left','right'].includes(image.position) && ['contain','cover'].includes(image.fit));
}
export async function readImage(file) {
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('請使用 PNG、JPEG 或 WebP 圖片；HEIC 請先在 Mac「預覽程式」轉存為 JPEG。');
  if (file.size > 12 * 1024 * 1024) throw new Error('圖片需小於 12 MB。');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();img.src=url;await img.decode();
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth*img.naturalHeight>40000000) throw new Error('圖片尺寸過大，請先縮小至 4,000 萬像素以內。');
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',.85);
    if(data.length>MAX_IMAGE_DATA)throw new Error('圖片處理後仍過大，請使用較小的圖片。');
    return {data,position:'right',fit:'contain'};
  } finally {URL.revokeObjectURL(url);}
}
export function imagePrompt(slide,topic,style) {
  return `請為繁體中文簡報製作一張原創插圖。\n簡報主題：${topic}\n本頁標題：${slide.title}\n本頁重點：${slide.bullets.join('；')}\n整體視覺方向：${style || '簡潔、專業、留白充足，所有頁面保持一致風格'}\n圖片比例 16:10，主體清楚，不要加入文字、標誌或浮水印。請先根據以上內容構思畫面，再生成圖片。我會下載圖片後放入簡報。`;
}
export async function exportImage(image, x, y, w, h) {
  const img=new Image();img.src=image.data;await img.decode();
  if(image.fit==='contain'){
    const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
    const iw=img.naturalWidth*scale,ih=img.naturalHeight*scale;
    return {data:image.data,x:x+(w-iw)/2,y:y+(h-ih)/2,w:iw,h:ih};
  }
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=Math.round(1600*h/w);
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  const scale=Math.max(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight);
  ctx.drawImage(img,(canvas.width-img.naturalWidth*scale)/2,(canvas.height-img.naturalHeight*scale)/2,img.naturalWidth*scale,img.naturalHeight*scale);
  return {data:canvas.toDataURL('image/jpeg',.9),x,y,w,h};
}

// Generate dummy examples by executing the production JS in Node/JSDOM + Canvas.
// Usage: CANVAS_MODULE=/path/to/@napi-rs/canvas node scripts/generate-review-examples.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { createCanvas, GlobalFonts, loadImage } = require(process.env.CANVAS_MODULE || '@napi-rs/canvas');
assert.ok(GlobalFonts.registerFromPath(process.env.EXAMPLE_FONT || '/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc', 'Example Japanese'), 'Japanese example font must be available');
// @napi-rs/canvas 0.1.80 applies source alpha twice for destination-out.
// Detect that backend defect independently; keep browser-equivalent alpha in the adapter.
const probe=createCanvas(2,2).getContext('2d');
probe.fillRect(0,0,2,2);probe.globalCompositeOperation='destination-out';
probe.globalAlpha=0.5;probe.fillRect(0,0,2,2);
const doubledOutAlpha=probe.getImageData(0,0,1,1).data[3]===191;
const root=resolve('u-t-on'), out=resolve(root,'common/examples');
let dom, w;
const run = async expression => vm.runInContext(expression,dom.getInternalVMContext());
const open = async name => {
    const previous = w ? Object.fromEntries(Array.from({length:w.localStorage.length},(_,i)=>{const k=w.localStorage.key(i);return [k,w.localStorage.getItem(k)];})) : {};
    dom?.window.close();
    dom=new JSDOM(await readFile(resolve(root,`tools/${name}.html`),'utf8'),{url:`https://example.invalid/tools/${name}`,runScripts:'outside-only',pretendToBeVisual:true});
    w=dom.window;
    await new Promise(r=>w.document.addEventListener('DOMContentLoaded',r,{once:true}));
    for (const [k,v] of Object.entries(previous)) w.localStorage.setItem(k,v);
    const canvases=new WeakMap();
    const backing = element => {
        if (!canvases.has(element)) canvases.set(element,createCanvas(element.width,element.height));
        const c=canvases.get(element);
        if (c.width!==element.width) c.width=element.width;
        if (c.height!==element.height) c.height=element.height;
        return c;
    };
    for (const key of ['width','height']) {
        const descriptor=Object.getOwnPropertyDescriptor(w.HTMLCanvasElement.prototype,key);
        Object.defineProperty(w.HTMLCanvasElement.prototype,key,{...descriptor,set(value){descriptor.set.call(this,value);if(canvases.has(this)) canvases.get(this)[key]=descriptor.get.call(this);}});
    }
    w.HTMLCanvasElement.prototype.getContext=function(){
        const ctx=backing(this).getContext('2d');
        return new Proxy(ctx,{get(target,key){
            if(key==='canvas') return target.canvas;
            if(key==='fill' && doubledOutAlpha) return (...args)=>{
                const alpha=target.globalAlpha;
                if(target.globalCompositeOperation==='destination-out') target.globalAlpha=Math.ceil(Math.sqrt(alpha)*255)/255;
                try { return target.fill(...args); } finally { target.globalAlpha=alpha; }
            };
            if(key==='drawImage') return (source,...args)=>target.drawImage(source instanceof w.HTMLCanvasElement?backing(source):source,...args);
            const value=target[key];return typeof value==='function'?value.bind(target):value;
        },set(target,key,value){target[key]=value;return true;}});
    };
    w.HTMLCanvasElement.prototype.toDataURL=function(type,quality){return backing(this).toDataURL(type,quality);};
    w.Blob=Blob;w.confirm=()=>true;w.alert=()=>{};w.scrollTo=()=>{};
    await run(await readFile(resolve(root,'common/tool-utils.js'),'utf8'));
    await run(await readFile(resolve(root,`tools/${name}.js`),'utf8'));
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    await run(`window.savedCSV=null;ToolUtils.downloadBlob=async blob=>{window.savedCSV=await blob.text();};window.savedImage=null;HTMLAnchorElement.prototype.click=function(){window.savedImage=this.href;};`);
};
const image = async (name, expression) => {
    const data=await run(expression);assert.match(data,/^data:image\/(png|jpeg);base64,/);
    await writeFile(resolve(out,name),Buffer.from(data.split(',')[1],'base64'));
};
const csv = async (name, expression) => {
    await run(expression);await new Promise(r=>setTimeout(r,0));
    const data=await run('savedCSV');assert.ok(data);
    if(name==='copy-pattan.csv') assert.ok(data.includes('こんにちは。\n開催日時：'), 'Example text must contain real line breaks');
    await writeFile(resolve(out,name),data);
};
// These diagrams quote actual values from the rendered DOM; they are not screenshots.
const shot = async name => {
    await new Promise(r=>setTimeout(r,400));
    let lines;
    if(name.startsWith('copy')) {
        lines=await run(`[ '素材', ...Array.from(document.querySelectorAll('.material-input'),e=>e.value), '作成エリア / ストック1', ...document.getElementById('mainTextArea').value.split('\\n') ]`);
    } else if(name.startsWith('counter')) {
        lines=await run(`['合計: '+document.getElementById('totalDisplay').textContent,...Array.from(document.querySelectorAll('#childContainer .counter-card'),e=>e.querySelector('input').value+'  '+e.querySelector('.count-value').textContent+'  '+e.querySelector('.ratio-display').textContent),document.querySelector('.group-name-input').value+'  '+document.querySelector('.group-count').textContent+'  '+document.querySelector('.group-ratio').textContent+'  '+document.querySelector('.group-prob').textContent]`);
    } else {
        lines=await run(`[state.config.weightType==='ratio'?'減算 / 比率':'減算 / ％',state.pendingWinner?'景品A 当選・SET前':'SET後',...state.currentWeights.map(i=>state.items.find(x=>x.id===i.id).name+'  重み '+i.weight+'  '+(i.active?'抽選対象':'対象外')),'履歴: '+state.history.length+'件']`);
    }
    const c=createCanvas(960, Math.max(260,100+lines.length*48)),x=c.getContext('2d');
    x.fillStyle='#f5f8f6';x.fillRect(0,0,c.width,c.height);x.fillStyle='#19383c';x.font='bold 22px "Example Japanese"';x.fillText('実際の画面表示値の抜粋（配置は説明用）',28,42);
    x.font='20px "Example Japanese"';lines.forEach((line,i)=>x.fillText(line,28,94+i*48,904));
    await writeFile(resolve(out,name),c.toBuffer('image/png'));
};
try {
    await open('koko-ni-mosaic');
    // A wholly fictional badge, drawn as an input with Canvas (not a fabricated output).
    const input = `(() => { const c=document.createElement('canvas'); c.width=480;c.height=180;const x=c.getContext('2d');x.fillStyle='#fff6df';x.fillRect(0,0,480,180);x.fillStyle='#19383c';x.font='bold 20px "Example Japanese"';x.fillText('架空の展示会 / DUMMY',24,36);x.font='32px "Example Japanese"';x.fillText('空野 サンプル',32,96);x.font='16px "Example Japanese"';x.fillText('見本専用・実在の人物ではありません',24,152);return c;})()`;
    await run(`window.sourceCanvas = ${input}`);
    await image('mosaic-input.png','sourceCanvas.toDataURL()');
    await run(`window.tool = new KokoNiMosaic(); tool.originalImage=sourceCanvas;tool.canvas.width=480;tool.canvas.height=180;tool.isImageLoaded=true;`);
    for (const pixelSize of [2,10,30]) {
        await image(`mosaic-${pixelSize}.png`, `(() => { tool.appliedMosaics=[{shape:'square',x:24,y:56,width:300,height:56,rotate:0,pixelSize:${pixelSize},invert:false}];tool.download();return savedImage; })()`);
    }
    await open('suke-touka');
    await run(`window.sourceCanvas = ${input};window.tool=new SukeTouka();tool.originalImage=sourceCanvas;tool.canvas.width=480;tool.canvas.height=180;tool.isImageLoaded=true;`);
    for (const opacity of [0,50,100]) {
        await image(`touka-${opacity}.png`, `(() => { tool.appliedTransparencies=[{shape:'square',x:24,y:56,width:300,height:56,rotate:0,opacity:${opacity/100}}];tool.download();return savedImage; })()`);
        // Check the saved artifact, rather than only the editor's working canvas.
        const decoded=await loadImage(await readFile(resolve(out,`touka-${opacity}.png`)));
        const output=createCanvas(480,180).getContext('2d');output.drawImage(decoded,0,0);
        const alpha=output.getImageData(40,70,1,1).data[3];
        assert.equal(output.getImageData(10,10,1,1).data[3],255, 'Outside the selection stays opaque');
        assert.ok(Math.abs(alpha - 255*(1-opacity/100)) <= 1, `opacity=${opacity}, alpha=${alpha}`);
        await image(`touka-${opacity}-background.png`, `(() => { const c=document.createElement('canvas');c.width=480;c.height=180;const x=c.getContext('2d');x.fillStyle='#65b8d0';x.fillRect(0,0,480,180);x.drawImage(tool.canvas,0,0);return c.toDataURL(); })()`);
    }
    await image('touka-100.jpg', `(() => {document.querySelector('input[value="image/jpeg"]').checked=true;tool.download();return savedImage;})()`);
    const jpeg=await loadImage(await readFile(resolve(out,'touka-100.jpg')));
    const jpegContext=createCanvas(480,180).getContext('2d');jpegContext.drawImage(jpeg,0,0);
    assert.ok(Array.from(jpegContext.getImageData(40,70,1,1).data).every(v=>v>=250), 'JPEG fills the transparent selection with white');
    await open('copy-pattan');
    await run(`localStorage.setItem('copyPattanData',JSON.stringify({mainText:'',materials:['こんにちは。','開催日時：11月20日 14:00','場所：架空の空色ホール'],stocks:[]}));`);
    await open('copy-pattan');
    await run(`document.querySelectorAll('.add-to-main-btn').forEach(b=>b.click()); const a=document.getElementById('mainTextArea'); a.value='こんにちは。\\n開催日時：11月20日 14:00\\n場所：架空の空色ホール'; a.dispatchEvent(new Event('input')); document.getElementById('saveStockBtn').click();`);
    await csv('copy-pattan.csv', `document.getElementById('exportCsvBtn').click()`);
    await shot('copy-pattan-screen.png');
    await open('any-counter');
    await run(`state={children:[{id:'car',name:'車',count:12},{id:'bike',name:'自転車',count:3},{id:'walk',name:'歩行者',count:5}],groups:[{id:'vehicles',name:'車両',memberIds:['car','bike']}]};render();`);
    await csv('counter-traffic.csv','exportCSV()');
    assert.match(await run(`document.getElementById('groupContainer').textContent`), /75/);
    await shot('counter-traffic-screen.png');
    await run(`state.children.forEach(c=>c.count=0);render()`);
    await csv('counter-zero.csv','exportCSV()');
    await shot('counter-zero-screen.png');
    await open('my-roulette');
    for (const type of ['ratio','percent']) {
        await run(`state.items=[{id:'a',name:'景品A',weight:${type==='ratio'?2:60},color:'#127b78'},{id:'b',name:'景品B',weight:${type==='ratio'?1:40},color:'#e6a04b'}];state.config.mode='subtraction';state.config.weightType='${type}';state.history=[];state.pendingWinner=null;resetCurrentWeights();render();`);
        await csv(`roulette-${type}.csv`,'exportCSV()');
        await run(`state.pendingWinner=state.items[0];showResult(state.pendingWinner.name);updateButtons();`);
        await shot(`roulette-${type}-before.png`);
        await run('handleSet()');
        assert.equal(await run(`state.currentWeights[0].${type==='ratio'?'weight':'active'}`),type==='ratio'?1:false);
        await shot(`roulette-${type}-after.png`);
    }
    console.log('Generated outputs and CSV via production JS; alpha, group and SET assertions passed.');
} finally { dom?.window.close(); }

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
async function setup(t) {
    const dom = new JSDOM(fs.readFileSync('u-t-on/tools/image-compare.html','utf8'),{url:'https://example.test/tools/image-compare.html',runScripts:'outside-only',pretendToBeVisual:true});
    const w=dom.window,d=w.document,bitmaps=[],downloads=[],revoked=[];
    t.after(()=>{w.dispatchEvent(new w.Event('pagehide'));w.close();});
    w.Blob=Blob;w.URL.createObjectURL=()=>`blob:${bitmaps.length}`;w.URL.revokeObjectURL=url=>revoked.push(url);
    w.ToolUtils={downloadBlob:(blob,name)=>downloads.push({blob,name})};
    w.fetch=async()=>({ok:true,blob:async()=>new Blob(['sample'],{type:'image/png'})});
    w.createImageBitmap=async file=>{
        if(w.decodeFails)throw new Error('bad data');
        const bytes=Uint8ClampedArray.from([0,0,0,255,0,0,0,255,0,0,0,255,0,0,0,255]);
        if(file.name.includes('B'))bytes.set([255,255,255,255],0);
        const bitmap={width:2,height:2,bytes,closed:false,close(){this.closed=true;}};bitmaps.push(bitmap);return bitmap;
    };
    function buffer(canvas){if(!canvas.testData||canvas.testData.length!==canvas.width*canvas.height*4)canvas.testData=new Uint8ClampedArray(canvas.width*canvas.height*4);return canvas.testData;}
    w.HTMLCanvasElement.prototype.getContext=function(){
        const canvas=this;
        return {fillRect(){const b=buffer(canvas);b.fill(255);},drawImage(bitmap){buffer(canvas).set(bitmap.bytes);},getImageData(){return{data:new Uint8ClampedArray(buffer(canvas))};},createImageData(width,height){return{data:new Uint8ClampedArray(width*height*4)};},putImageData(image){buffer(canvas).set(image.data);}};
    };
    w.HTMLCanvasElement.prototype.toBlob=function(callback){const data=new Uint8ClampedArray(buffer(this));setTimeout(()=>callback(w.encodeFails?null:new Blob([data],{type:'image/png'})),0);};
    w.eval(fs.readFileSync('u-t-on/tools/image-compare-core.js','utf8'));w.eval(fs.readFileSync('u-t-on/tools/image-compare.js','utf8'));
    const wait=async predicate=>{const deadline=Date.now()+3000;while(!predicate()){if(Date.now()>deadline)throw new Error('Timed out: '+d.getElementById('status').textContent);await new Promise(r=>setTimeout(r,2));}};
    const click=async id=>{d.getElementById(id).click();await wait(()=>d.getElementById('cancelBtn').hidden);};
    await click('sampleBtn');return{w,d,wait,click,bitmaps,downloads,revoked};
}
test('Comparison page shows the metric, invalidates stale results, and releases decoded images',async t=>{
    const e=await setup(t);await e.click('compareBtn');
    assert.equal(e.d.getElementById('tolerance').value,'20', 'Illustration sample uses the documented noise tolerance');
    assert.equal(e.d.getElementById('percent').textContent,'25.00%');assert.equal(e.d.getElementById('result').hidden,false);
    assert.ok(e.bitmaps.every(b=>b.closed));
    e.d.getElementById('tolerance').value=10;e.d.getElementById('tolerance').dispatchEvent(new e.w.Event('input'));
    assert.equal(e.d.getElementById('result').hidden,true);assert.match(e.d.getElementById('status').textContent,/比較する/);
    await e.click('compareBtn');assert.equal(e.d.getElementById('result').hidden,false);
    await e.click('clearBtn');assert.equal(e.d.getElementById('compareBtn').disabled,true);assert.equal(e.revoked.length,2);
});
test('Changing red opacity keeps the rate; PNG save uses highlighted B even while viewing A',async t=>{
    const e=await setup(t);await e.click('compareBtn');
    const initial=e.d.getElementById('percent').textContent;
    e.d.getElementById('opacity').value=50;e.d.getElementById('opacity').dispatchEvent(new e.w.Event('input'));
    await e.click('viewA');assert.equal(e.d.getElementById('percent').textContent,initial);
    await e.click('downloadBtn');assert.equal(e.downloads[0].name,'image-diff.png');
    const data=new Uint8Array(await e.downloads[0].blob.arrayBuffer());
    assert.deepEqual([...data.slice(0,4)],[245,155,160,255]);assert.deepEqual([...data.slice(4,8)],[0,0,0,255]);
});
test('Comparison cancellation publishes no partial rate and decoding failure allows retry',async t=>{
    const e=await setup(t);e.d.getElementById('compareBtn').click();e.d.getElementById('cancelBtn').click();
    await e.wait(()=>e.d.getElementById('cancelBtn').hidden);
    assert.equal(e.d.getElementById('result').hidden,true);assert.match(e.d.getElementById('status').textContent,/中止/);
    e.w.decodeFails=true;await e.click('compareBtn');assert.match(e.d.getElementById('status').textContent,/画像を読み込めません/);
    assert.equal(e.d.getElementById('result').hidden,true);e.w.decodeFails=false;await e.click('compareBtn');
    assert.equal(e.d.getElementById('percent').textContent,'25.00%');assert.ok(e.bitmaps.every(b=>b.closed));
});
test('Difference-only toggle hides the source, preserves the rate, and exports a transparent layer',async t=>{
    const e=await setup(t);await e.click('compareBtn');await e.click('viewA');
    e.d.getElementById('diffOnly').click();
    assert.equal(e.d.getElementById('viewDiff').getAttribute('aria-pressed'),'true');
    assert.equal(e.d.getElementById('percent').textContent,'25.00%');
    assert.deepEqual([...e.d.getElementById('resultCanvas').testData.slice(4,8)],[0,0,0,0]);
    await e.click('downloadBtn');assert.equal(e.downloads[0].name,'image-diff-layer.png');
    const bytes=new Uint8Array(await e.downloads[0].blob.arrayBuffer());
    assert.deepEqual([...bytes.slice(0,4)],[235,55,65,77]);assert.deepEqual([...bytes.slice(4,8)],[0,0,0,0]);
    await e.click('viewB');assert.equal(e.d.getElementById('diffOnly').checked,false);
    assert.equal(e.d.getElementById('downloadBtn').textContent,'赤い差分画像をPNG保存');
});

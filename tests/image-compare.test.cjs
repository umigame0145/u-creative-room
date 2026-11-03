const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../u-t-on/tools/image-compare-core.js');
const solid = (pixels, color) => Uint8ClampedArray.from(Array.from({ length: pixels }, () => color).flat());
const grid = (w, h) => ({ width:w, height:h, aw:w, ah:h, bw:w, bh:h });
const fast = { yieldTask: async () => {} };

test('Identical images report zero and one changed pixel counts once, not once per channel', async () => {
    const a = solid(4, [0,0,0,255]), b = new Uint8ClampedArray(a);
    assert.equal((await C.compare(a,b,grid(2,2),0,fast)).percent, 0);
    b.set([255,200,100,255],4);
    const r = await C.compare(a,b,grid(2,2),0,fast);
    assert.equal(r.changed,1); assert.equal(r.total,4); assert.equal(r.percent,25);
    assert.deepEqual([...r.mask],[0,1,0,0]);
});
test('Tolerance is per visible RGB channel and its exact boundary is excluded', async () => {
    const a = solid(1,[100,100,100,255]), b = solid(1,[110,100,100,255]);
    assert.equal((await C.compare(a,b,grid(1,1),10,fast)).changed,0);
    assert.equal((await C.compare(a,b,grid(1,1),9,fast)).changed,1);
    await assert.rejects(C.compare(a,b,grid(1,1),NaN));
});
test('Transparent hidden color is ignored, while visible alpha differences count', async () => {
    const a = solid(1,[0,0,0,0]), b = solid(1,[255,0,50,0]);
    assert.equal((await C.compare(a,b,grid(1,1),0,fast)).changed,0);
    assert.equal((await C.compare(a,solid(1,[255,255,255,255]),grid(1,1),0,fast)).changed,0);
    assert.equal((await C.compare(a,solid(1,[0,0,0,128]),grid(1,1),0,fast)).changed,1);
});
test('Unequal sizes count missing image areas even when white and exclude both-empty corners', async () => {
    const a=solid(4,[255,255,255,255]),b=new Uint8ClampedArray(a);
    const r=await C.compare(a,b,{width:2,height:2,aw:2,ah:1,bw:1,bh:2},0,fast);
    assert.equal(r.total,3);assert.equal(r.changed,2);assert.deepEqual([...r.mask],[0,1,1,0]);
    assert.ok(Math.abs(r.percent-200/3)<1e-10);
});
test('Red overlay changes only marked pixels and opacity does not affect the metric', async () => {
    const base=solid(2,[100,150,200,255]);
    const out=C.overlay(base,Uint8Array.from([0,1]),.3);
    assert.deepEqual([...out.slice(0,4)],[100,150,200,255]);
    assert.deepEqual([...out.slice(4)],[141,122,160,255]);
    assert.deepEqual([...C.overlay(base,Uint8Array.from([1,1]),0)],[...base]);
    assert.deepEqual([...C.overlay(solid(1,[0,0,0,0]),Uint8Array.from([0]))],[255,255,255,255]);
});
test('Comparison uses the union size without rescaling small images; large images share a bounded scale', () => {
    assert.deepEqual(C.layout({width:4,height:3},{width:2,height:5}),{width:4,height:5,aw:4,ah:3,bw:2,bh:5,scale:1});
    const g=C.layout({width:8000,height:4000},{width:4000,height:2000});
    assert.ok(g.width*g.height<=C.LIMITS.pixels);assert.ok(Math.max(g.width,g.height)<=3000);
    assert.ok(Math.abs(g.aw/g.bw-2)<.01);assert.ok(g.scale<1);
    assert.throws(()=>C.layout({width:0,height:5},{width:2,height:2}));
});
test('Difference-only layer contains no source colors and makes unchanged pixels transparent', () => {
    const result = C.overlay(solid(2,[235,55,65,255]),Uint8Array.from([0,1]),.3,true);
    assert.deepEqual([...result],[0,0,0,0,235,55,65,77]);
});
test('Cancellation interrupts comparison and small nonzero changes never display as zero', async () => {
    let checks=0;
    await assert.rejects(C.compare(solid(100,[0,0,0,255]),solid(100,[0,0,0,255]),grid(10,10),0,{check(){if(++checks===3)throw new Error('stop');},...fast}),/stop/);
    assert.equal(C.formatPercent(0),'0.00');assert.equal(C.formatPercent(.000025),'< 0.01');assert.equal(C.formatPercent(100),'100.00');
});
test('Sample-sized patch has precisely 10% difference and comparison rejects malformed buffers', async () => {
    const a=solid(400000,[42,117,104,255]),b=new Uint8ClampedArray(a);
    for(let y=200;y<400;y++)for(let x=540;x<740;x++)b.set([214,142,60,255],(y*800+x)*4);
    const r=await C.compare(a,b,grid(800,500),0,fast);assert.equal(r.percent,10);assert.equal(r.changed,40000);
    await assert.rejects(C.compare(new Uint8Array(1),b,grid(800,500)));
});

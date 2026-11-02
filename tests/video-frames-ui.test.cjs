const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const C = require('../u-t-on/tools/video-frames-core.js');

async function setup(t, count = 240) {
    const dom = new JSDOM(fs.readFileSync('u-t-on/tools/video-frames.html', 'utf8'), { url: 'https://example.test/tools/video-frames.html', runScripts: 'outside-only' });
    const w = dom.window, d = w.document, samples = [], downloads = [], revoked = [];
    t.after(() => { w.dispatchEvent(new w.Event('pagehide')); dom.window.close(); });
    const packets = Array.from({ length: count }, (_, i) => ({ timestamp: i / 30, duration: 1 / 30 }));
    const track = { getDisplayWidth: async () => 640, getDisplayHeight: async () => 360, getCodedWidth: async () => 640, getCodedHeight: async () => 360, canDecode: async () => true };
    w.isSecureContext = true; w.VideoDecoder = function () {}; w.Blob = Blob;
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
    w.Input = class { async getPrimaryVideoTrack() { return track; } dispose() {} };
    w.BlobSource = class {}; w.MP4 = {}; w.QTFF = {}; w.WEBM = {};
    w.EncodedPacketSink = class { async *packets() { yield* packets; } };
    function sample(p) {
        const s = { timestamp: Math.round(p.timestamp * 1e6) / 1e6, duration: p.duration, displayWidth: 640, displayHeight: 360, closed: false,
            draw(ctx) { ctx.canvas.lastTimestamp = this.timestamp; }, close() { this.closed = true; } };
        samples.push(s); return s;
    }
    w.VideoSampleSink = class {
        async getSample(time) { const p = packets.filter(p => p.timestamp <= time).at(-1); return p ? sample(p) : null; }
        async *samples(start, end) { for (const [i, p] of packets.entries()) if (p.timestamp >= start && p.timestamp < end && i !== w.omitIndex) yield sample(p); }
        async *samplesAtTimestamps(times) { for (const time of times) yield await this.getSample(time); }
    };
    w.HTMLCanvasElement.prototype.getContext = function () { return { canvas: this, drawImage() {}, fillRect() {}, fillText() {} }; };
    w.HTMLCanvasElement.prototype.toBlob = function (callback, type) {
        const blob = w.largeImages && this.width > 160 ? { size: C.LIMITS.bytes / 2 + 1, type } : new Blob(['image'], { type });
        setTimeout(() => callback(w.encoderFails ? null : blob), 0);
    };
    let seq = 0;
    w.URL.createObjectURL = () => `blob:test-${++seq}`; w.URL.revokeObjectURL = url => revoked.push(url);
    w.ToolUtils = { downloadBlob: (blob, name) => downloads.push({ blob, name }) };
    w.fetch = async () => ({ ok: true, blob: async () => new Blob(['test']) });
    w.eval(fs.readFileSync('u-t-on/tools/video-frames-core.js', 'utf8'));
    w.eval('(function(){' + fs.readFileSync('u-t-on/tools/video-frames.mjs', 'utf8').replace(/^import .*;\r?\n/, '') + '})()');
    const wait = async predicate => {
        const deadline = Date.now() + 5000;
        while (!predicate()) { if (Date.now() > deadline) throw new Error('UI wait timed out: ' + d.getElementById('status').textContent); await new Promise(r => setTimeout(r, 2)); }
    };
    const click = async id => { d.getElementById(id).click(); await wait(() => d.getElementById('cancelBtn').hidden); };
    await click('sampleBtn');
    return { w, d, samples, downloads, revoked, wait, click };
}
test('Frame UI queries fractional PTS correctly, closes samples, and saves the chosen exact frame', async t => {
    const e = await setup(t, 4);
    await e.click('nextBtn'); assert.match(e.d.getElementById('framePosition').textContent, /^2 \/ 4/);
    assert.equal(e.d.getElementById('preview').lastTimestamp, .033333);
    await e.click('saveFrameBtn'); assert.equal(e.downloads[0].name, 'frame_000002_33333us.png');
    assert.ok(e.samples.every(s => s.closed));
});
test('Frame UI outputs 200 then 40, keeps continuation settings, and revokes replaced image URLs', async t => {
    const e = await setup(t);
    await e.click('extractBtn'); assert.equal(e.d.querySelectorAll('#gallery figure').length, 200);
    assert.equal(e.d.getElementById('continueBtn').hidden, false);
    e.d.getElementById('format').value = 'jpeg';
    await e.click('continueBtn'); assert.equal(e.d.querySelectorAll('#gallery figure').length, 40);
    assert.match(e.d.querySelector('#gallery figcaption').textContent, /^#201 /);
    assert.match(e.d.querySelector('#gallery a').download, /\.png$/);
    assert.equal(e.d.getElementById('continueBtn').hidden, true); assert.equal(e.revoked.length, 400);
    assert.ok(e.samples.every(s => s.closed));
});
test('Frame UI stops at the image-byte limit and resumes on the next unexported frame', async t => {
    const e = await setup(t, 5); e.w.largeImages = true;
    await e.click('extractBtn'); assert.equal(e.d.querySelectorAll('#gallery figure').length, 1);
    assert.match(e.d.getElementById('status').textContent, /96MB/);
    assert.equal(e.d.getElementById('continueBtn').hidden, false);
    e.w.largeImages = false; await e.click('continueBtn');
    assert.equal(e.d.querySelectorAll('#gallery figure').length, 4);
    assert.match(e.d.querySelector('#gallery figcaption').textContent, /^#2 /);
    assert.ok(e.samples.every(s => s.closed));
});
test('Frame UI does not label missing decoded frames as complete', async t => {
    const e = await setup(t, 5); e.w.omitIndex = 2;
    await e.click('extractBtn'); assert.match(e.d.getElementById('status').textContent, /順序が一致しません/);
    assert.equal(e.d.querySelectorAll('#gallery figure').length, 2);
    assert.equal(e.d.getElementById('continueBtn').hidden, true);
    assert.ok(e.samples.every(s => s.closed));
});
test('Frame UI cancellation retains only completed frames and leaves controls usable', async t => {
    const e = await setup(t, 30); e.d.getElementById('extractBtn').click();
    await e.wait(() => e.d.querySelectorAll('#gallery figure').length >= 2);
    e.d.getElementById('cancelBtn').click(); await e.wait(() => e.d.getElementById('cancelBtn').hidden);
    assert.match(e.d.getElementById('status').textContent, /中止/);
    const count = e.d.querySelectorAll('#gallery figure').length;
    assert.ok(count >= 2 && count < 30); assert.equal(e.d.getElementById('continueBtn').hidden, false);
    assert.equal(e.d.getElementById('extractBtn').disabled, false); assert.ok(e.samples.every(s => s.closed));
});
test('Frame UI encoder failure closes samples and permits retry without stale results', async t => {
    const e = await setup(t, 5); e.w.encoderFails = true;
    await e.click('extractBtn'); assert.match(e.d.getElementById('status').textContent, /画像の保存に失敗/);
    assert.ok(e.samples.every(s => s.closed)); e.w.encoderFails = false;
    await e.click('extractBtn'); assert.equal(e.d.querySelectorAll('#gallery figure').length, 5);
});

async function zipContents(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer), files = new Map();
    let offset = 0;
    while (view.getUint32(offset, true) === 0x04034b50) {
        const size = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
        const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
        const start = offset + 30 + nameLength + extra;
        files.set(name, bytes.slice(start, start + size)); offset = start + size;
    }
    return files;
}
test('Frame selection saves only arbitrary chosen frames in original order with a matching CSV', async t => {
    const e = await setup(t, 6); await e.click('extractBtn');
    assert.equal(e.d.getElementById('selectedZipBtn').disabled, true);
    const boxes = e.d.querySelectorAll('#gallery input[type="checkbox"]');
    boxes[4].click(); boxes[0].click(); boxes[2].click();
    assert.equal(e.d.getElementById('selectionInfo').textContent, '3 / 6枚を選択中');
    assert.equal(e.d.querySelectorAll('#gallery .is-selected').length, 3);
    await e.click('selectedZipBtn');
    assert.equal(e.downloads[0].name, 'video-frames-selected.zip');
    const files = await zipContents(e.downloads[0].blob);
    assert.deepEqual([...files.keys()], ['frame_000001_0us.png','frame_000003_66667us.png','frame_000005_133333us.png','frames.csv']);
    const csv = new TextDecoder().decode(files.get('frames.csv'));
    assert.deepEqual(csv.trim().split('\r\n').slice(1).map(row => Number(row.split(',')[0])), [1,3,5]);
    assert.equal(e.d.getElementById('selectionInfo').textContent, '3 / 6枚を選択中');
});
test('Select all, deselect, individual toggle and result replacement reset selection reliably', async t => {
    const e = await setup(t, 5); await e.click('extractBtn');
    await e.click('selectAllBtn'); assert.equal(e.d.querySelectorAll('#gallery input:checked').length, 5);
    assert.equal(e.d.getElementById('selectAllBtn').disabled, true);
    e.d.querySelector('#gallery input').click();
    assert.equal(e.d.getElementById('selectionInfo').textContent, '4 / 5枚を選択中');
    assert.equal(e.d.getElementById('selectAllBtn').disabled, false);
    await e.click('deselectAllBtn'); assert.equal(e.d.querySelectorAll('#gallery input:checked').length, 0);
    assert.equal(e.d.getElementById('selectedZipBtn').disabled, true);
    await e.click('selectedZipBtn'); assert.equal(e.downloads.length, 0);
    await e.click('selectAllBtn'); await e.click('extractBtn');
    assert.equal(e.d.getElementById('selectionInfo').textContent, '0 / 5枚を選択中');
    assert.equal(e.d.getElementById('selectedZipBtn').disabled, true);
    await e.click('clearBtn'); assert.equal(e.d.getElementById('selectionInfo').textContent, '0 / 0枚を選択中');
});
test('Selected ZIP locks selection during export while all-image ZIP stays independent', async t => {
    const e = await setup(t, 5); await e.click('extractBtn');
    e.d.querySelector('#gallery input').click();
    e.d.getElementById('selectedZipBtn').click();
    assert.equal(e.d.getElementById('selectAllBtn').disabled, true);
    assert.ok([...e.d.querySelectorAll('#gallery input')].every(box => box.disabled));
    await e.wait(() => e.d.getElementById('cancelBtn').hidden);
    assert.equal(e.d.querySelector('#gallery input').disabled, false);
    await e.click('zipBtn');
    const files = await zipContents(e.downloads[1].blob);
    assert.equal([...files.keys()].filter(name => name.endsWith('.png')).length, 5);
    assert.equal(e.downloads[1].name, 'video-frames.zip');
});

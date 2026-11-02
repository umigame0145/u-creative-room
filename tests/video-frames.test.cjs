const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const C = require('../u-t-on/tools/video-frames-core.js');
const frames = (count, fps = 30) => C.timeline(Array.from({ length: count }, (_, i) => ({ timestamp: i / fps, duration: 1 / fps })));

test('Video timeline sorts B-frame presentation order and preserves VFR and source timestamps', () => {
    const result = C.timeline([{ timestamp: 5.13, duration: .08 }, { timestamp: 5, duration: .04 }, { timestamp: 5.04, duration: .09 }]);
    assert.deepEqual(result.map(f => f.timestamp), [5, 5.04, 5.13]);
    assert.equal(result[0].time, 0); assert.ok(Math.abs(result[2].time - .13) < 1e-12);
    for (const [i, value] of [.04, .09, .08].entries()) assert.ok(Math.abs(result[i].duration - value) < 1e-12);
    assert.equal(C.timeline([{ timestamp: -.04, duration: .04 }, { timestamp: 0, duration: .06 }])[1].time, .04);
    const vfr = C.timeline([0, .04, .12].map(timestamp => ({ timestamp, duration: .04 })));
    assert.ok(Math.abs(vfr[1].duration - .08) < 1e-12, 'VFR hold duration uses adjacent presentation timestamps');
});
test('Video timeline refuses duplicate, nonfinite or ambiguous timestamps instead of claiming completeness', () => {
    for (const packets of [[], [{ timestamp: NaN, duration: 1 }], [{ timestamp: 0, duration: -1 }], [{ timestamp: 0, duration: 1 }, { timestamp: .0000001, duration: 1 }]]) assert.throws(() => C.timeline(packets));
});
test('All-frame batches cap at 200 and continuations preserve every frame without duplication', () => {
    const all = frames(401), p = C.plan(all, 0, 401 / 30, 'all', 1);
    assert.equal(p.total, 401); assert.equal(p.frames.length, 200); assert.equal(p.next, all[200].time);
    const groups = [p.remaining.slice(0, 200), p.remaining.slice(200, 400), p.remaining.slice(400)];
    assert.deepEqual(groups.map(a => a.length), [200, 200, 1]);
    assert.deepEqual(groups.flat().map(f => f.index), all.map(f => f.index));
    assert.equal(C.plan(frames(200), 0, 200 / 30, 'all', 1).next, null);
});
test('Frame ranges include start, exclude end, and respect exact selected VFR boundaries', () => {
    const all = C.timeline([0, .04, .13, .18, .4].map(t => ({ timestamp: t, duration: .04 })));
    assert.deepEqual(C.plan(all, .04, .4, 'all', 1).frames.map(f => f.index), [1, 2, 3]);
    assert.equal(C.plan(all, .2, .3, 'all', 1).total, 0);
});
test('Interval mode selects actual frames at/after targets, skips duplicates, and keeps the anchor across batches', () => {
    const all = C.timeline([0, .04, .13, .18, .4].map(t => ({ timestamp: t, duration: .04 })));
    assert.deepEqual(C.plan(all, 0, .5, 'interval', .1).frames.map(f => f.index), [0, 2, 4]);
    assert.equal(C.plan(frames(60), 0, 2, 'interval', .01).total, 60);
    const long = C.plan(frames(30000), .015, 999, 'interval', .137);
    assert.deepEqual(long.frames, long.remaining.slice(0, 200));
    assert.equal(new Set(long.remaining.map(f => f.index)).size, long.total);
});
test('Frame planner rejects bad ranges and invalid interval settings', () => {
    for (const [start, end, mode, interval] of [[NaN, 1, 'all', 1], [-1, 1, 'all', 1], [1, 1, 'all', 1], [0, 1, 'interval', .001], [0, 1, 'interval', Infinity], [0, 1, 'bad', 1]]) assert.throws(() => C.plan(frames(30), start, end, mode, interval));
});
test('Output sizing preserves aspect ratio, caps long side and never enlarges a small video', () => {
    assert.deepEqual(C.size(3840, 2160, 1280), { width: 1280, height: 720 });
    assert.deepEqual(C.size(1080, 1920, 640), { width: 360, height: 640 });
    assert.deepEqual(C.size(320, 180, 1920), { width: 320, height: 180 });
    assert.throws(() => C.size(3840, 2160, 3840));
    assert.equal(C.LIMITS.frames, 200); assert.equal(C.LIMITS.bytes, 96 * 1024 * 1024);
});
test('ZIP includes UTF-8 filenames, valid checksums and offsets and exact original file bytes', async () => {
    const entries = [{ name: 'frame_000001_0us.png', blob: new Blob([Uint8Array.from([137,80,78,71,0,255])]) }, { name: '時刻表.csv', blob: new Blob(['frame,time\r\n1,0\r\n']) }];
    const archive = await C.zip(entries), bytes = new Uint8Array(await archive.arrayBuffer()), view = new DataView(bytes.buffer);
    assert.equal(archive.type, 'application/zip'); assert.equal(C.crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
    const end = bytes.length - 22; assert.equal(view.getUint32(end, true), 0x06054b50); assert.equal(view.getUint16(end + 10, true), 2);
    let dir = view.getUint32(end + 16, true), offset = 0;
    for (const entry of entries) {
        const name = new TextEncoder().encode(entry.name), payload = new Uint8Array(await entry.blob.arrayBuffer());
        assert.equal(view.getUint32(offset, true), 0x04034b50); assert.equal(view.getUint16(offset + 6, true), 0x800);
        assert.equal(view.getUint32(offset + 14, true), C.crc32(payload)); assert.equal(view.getUint32(offset + 18, true), payload.length);
        assert.deepEqual(bytes.slice(offset + 30, offset + 30 + name.length), name);
        assert.deepEqual(bytes.slice(offset + 30 + name.length, offset + 30 + name.length + payload.length), payload);
        assert.equal(view.getUint32(dir, true), 0x02014b50); assert.equal(view.getUint32(dir + 42, true), offset);
        offset += 30 + name.length + payload.length; dir += 46 + name.length;
    }
    assert.equal(offset, view.getUint32(end + 16, true)); assert.equal(dir, end);
});
test('ZIP enforces resource limits and honors cancellation', async () => {
    await assert.rejects(C.zip(Array.from({ length: 202 }, () => ({ name: 'x', blob: new Blob() }))));
    await assert.rejects(C.zip([{ name: 'x', blob: { size: C.LIMITS.bytes + 65537 } }]));
    await assert.rejects(C.zip([{ name: 'x', blob: new Blob(['a']) }], () => { throw new Error('cancelled'); }), /cancelled/);
});
test('Frame manifest names remain unique for repeated images and retain original presentation time', () => {
    const f = C.timeline([{ timestamp: 10, duration: .04 }, { timestamp: 10.04, duration: .08 }]).map(f => ({ ...f, name: C.filename(f, 'png') }));
    assert.notEqual(f[0].name, f[1].name);
    assert.match(C.manifest(f), /1,0\.000000000,10\.000000000,0\.040000000,frame_000001_0us.png/);
});
test('Vendored media reader is pinned with its license and reads actual MP4 packet times', async () => {
    const path = 'u-t-on/common/vendor/mediabunny-1.65.0.min.mjs';
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex'), '7898aa3e638df09ac3f59bfcbdef2757bbbd1a78f24d3339247a07e674a7877d');
    assert.match(fs.readFileSync('u-t-on/common/vendor/mediabunny-LICENSE.txt', 'utf8'), /Mozilla Public License/);
    const { Input, BufferSource, MP4, EncodedPacketSink } = await import('../' + path);
    const input = new Input({ formats: [MP4], source: new BufferSource(fs.readFileSync('u-t-on/common/examples/video-frames-sample.mp4')) });
    try {
        const track = await input.getPrimaryVideoTrack(), packets = [];
        for await (const p of new EncodedPacketSink(track).packets(undefined, undefined, { metadataOnly: true })) packets.push({ timestamp: p.timestamp, duration: p.duration });
        const timeline = C.timeline(packets);
        assert.equal(timeline.length, 240); assert.equal(timeline[0].time, 0); assert.ok(Math.abs(timeline.at(-1).time - 239 / 30) < 1e-8);
        assert.ok(packets.some((p, i) => i && p.timestamp < packets[i - 1].timestamp), 'Fixture exercises B-frame reordering');
    } finally { input.dispose(); }
});

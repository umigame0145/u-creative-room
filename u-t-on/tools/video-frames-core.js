/* Frame planning and bounded ZIP output. Shared with the regression tests. */
(function (root) {
    'use strict';
    const LIMITS = Object.freeze({ frames: 200, bytes: 96 * 1024 * 1024, file: 512 * 1024 * 1024, packets: 120000, pixels: 4096 * 2160 });
    function timeline(packets) {
        const sorted = packets.map(p => ({ timestamp: p.timestamp, duration: p.duration })).sort((a, b) => a.timestamp - b.timestamp);
        if (!sorted.length) throw new Error('映像のフレームが見つかりません。');
        const base = sorted[0].timestamp;
        return sorted.map((p, index) => {
            if (!Number.isFinite(p.timestamp) || !Number.isFinite(p.duration) || p.duration < 0 ||
                (index && Math.round(p.timestamp * 1e6) <= Math.round(sorted[index - 1].timestamp * 1e6))) {
                throw new Error('フレーム時刻を一意に判別できない動画です。このファイルには対応していません。');
            }
            // Presentation duration comes from the next PTS, not decode-order packet spacing (VFR/B-frames).
            const duration = index + 1 < sorted.length ? sorted[index + 1].timestamp - p.timestamp : p.duration;
            return { ...p, duration, index, time: p.timestamp - base };
        });
    }
    function lowerBound(frames, time) {
        let low = 0, high = frames.length;
        while (low < high) { const mid = (low + high) >>> 1; if (frames[mid].time < time) low = mid + 1; else high = mid; }
        return low;
    }
    function plan(frames, start, end, mode, interval) {
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw new Error('開始と終了を正しく指定してください。終了は開始より後にしてください。');
        if (!['all', 'interval'].includes(mode)) throw new Error('抽出方法を選んでください。');
        if (mode === 'interval' && (!Number.isFinite(interval) || interval < 0.01)) throw new Error('間隔は0.01秒以上で指定してください。');
        const first = lowerBound(frames, start), last = lowerBound(frames, end);
        const selected = [];
        let target = start, tick = 0;
        for (let i = first; i < last; i++) {
            if (mode === 'all' || frames[i].time + 1e-9 >= target) {
                selected.push(frames[i]);
                if (mode === 'interval') {
                    // Choose the first actual frame at/after each interval; never duplicate a frame.
                    tick = Math.floor((frames[i].time - start + 1e-9) / interval) + 1;
                    target = start + tick * interval;
                }
            }
        }
        return { total: selected.length, frames: selected.slice(0, LIMITS.frames), remaining: selected, next: selected[LIMITS.frames]?.time ?? null };
    }
    function size(width, height, maxSide) {
        if (![width, height, maxSide].every(v => Number.isFinite(v) && v > 0) || maxSide > 1920) throw new Error('画像サイズを確認してください。');
        const scale = Math.min(1, maxSide / Math.max(width, height));
        return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
    }
    function filename(frame, extension) { return `frame_${String(frame.index + 1).padStart(6, '0')}_${Math.round(frame.time * 1e6)}us.${extension}`; }
    function manifest(frames) {
        return 'frame,elapsed_seconds,source_timestamp_seconds,duration_seconds,file\r\n' + frames.map(f =>
            `${f.index + 1},${f.time.toFixed(9)},${f.timestamp.toFixed(9)},${f.duration.toFixed(9)},${f.name}`).join('\r\n') + '\r\n';
    }
    const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
        for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
        return n >>> 0;
    });
    function crc32(data) {
        let crc = 0xffffffff;
        for (const byte of data) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
        return (crc ^ 0xffffffff) >>> 0;
    }
    function header(length) {
        const bytes = new Uint8Array(length), view = new DataView(bytes.buffer);
        return { bytes, u16: (p, v) => view.setUint16(p, v, true), u32: (p, v) => view.setUint32(p, v, true) };
    }
    // Images are already compressed. STORE avoids an additional full-size compression buffer.
    async function zip(entries, check = () => {}) {
        if (entries.length > LIMITS.frames + 1 || entries.reduce((n, e) => n + e.blob.size, 0) > LIMITS.bytes + 65536) throw new Error('ZIPに保存できる容量を超えています。');
        const parts = [], central = [];
        let offset = 0, centralSize = 0;
        for (const entry of entries) {
            check();
            const name = new TextEncoder().encode(entry.name), data = new Uint8Array(await entry.blob.arrayBuffer());
            const crc = crc32(data), local = header(30), dir = header(46);
            local.u32(0, 0x04034b50); local.u16(4, 20); local.u16(6, 0x800); local.u16(12, 33);
            local.u32(14, crc); local.u32(18, data.length); local.u32(22, data.length); local.u16(26, name.length);
            dir.u32(0, 0x02014b50); dir.u16(4, 20); dir.u16(6, 20); dir.u16(8, 0x800); dir.u16(14, 33);
            dir.u32(16, crc); dir.u32(20, data.length); dir.u32(24, data.length); dir.u16(28, name.length); dir.u32(42, offset);
            // Keep the original Blob, not all uncompressed Uint8Arrays, alive in the archive.
            parts.push(local.bytes, name, entry.blob); central.push(dir.bytes, name);
            offset += 30 + name.length + data.length; centralSize += 46 + name.length;
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        check();
        const end = header(22); end.u32(0, 0x06054b50); end.u16(8, entries.length); end.u16(10, entries.length); end.u32(12, centralSize); end.u32(16, offset);
        return new Blob([...parts, ...central, end.bytes], { type: 'application/zip' });
    }
    const api = { LIMITS, timeline, lowerBound, plan, size, filename, manifest, zip, crc32 };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.VideoFramesCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

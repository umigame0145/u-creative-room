/* Pixel comparison, independent of the page and covered by regression tests. */
(function (root) {
    'use strict';
    const LIMITS = Object.freeze({ pixels: 4000000, side: 3000, sourcePixels: 24000000, fileBytes: 30 * 1024 * 1024 });
    function layout(a, b) {
        if (![a.width, a.height, b.width, b.height].every(n => Number.isInteger(n) && n > 0)) throw new Error('画像サイズを取得できません。');
        const width = Math.max(a.width, b.width), height = Math.max(a.height, b.height);
        const scale = Math.min(1, Math.sqrt(LIMITS.pixels / (width * height)), LIMITS.side / Math.max(width, height));
        // Floor prevents rounding above the processing budget. Both images use the same scale.
        const aw = Math.max(1, Math.floor(a.width * scale)), ah = Math.max(1, Math.floor(a.height * scale));
        const bw = Math.max(1, Math.floor(b.width * scale)), bh = Math.max(1, Math.floor(b.height * scale));
        return { width: Math.max(aw, bw), height: Math.max(ah, bh), aw, ah, bw, bh, scale };
    }
    function visible(channel, alpha) { return alpha === 255 ? channel : Math.round((channel * alpha + 255 * (255 - alpha)) / 255); }
    async function compare(a, b, grid, tolerance = 0, options = {}) {
        const { width, height, aw, ah, bw, bh } = grid;
        if (![width,height,aw,ah,bw,bh].every(n => Number.isInteger(n) && n > 0) || width !== Math.max(aw,bw) || height !== Math.max(ah,bh) || width * height > LIMITS.pixels || a.length !== width * height * 4 || b.length !== a.length) throw new Error('比較用の画像データが不正です。');
        if (!Number.isInteger(tolerance) || tolerance < 0 || tolerance > 255) throw new Error('許容値は0〜255で指定してください。');
        const mask = new Uint8Array(width * height);
        let changed = 0, total = 0;
        for (let y = 0; y < height; y++) {
            options.check?.();
            for (let x = 0; x < width; x++) {
                const inA = x < aw && y < ah, inB = x < bw && y < bh;
                if (!inA && !inB) continue;
                total++;
                const p = y * width + x, i = p * 4;
                let different = inA !== inB;
                if (!different) {
                    for (let c = 0; c < 3; c++) {
                        if (Math.abs(visible(a[i+c],a[i+3]) - visible(b[i+c],b[i+3])) > tolerance) { different = true; break; }
                    }
                }
                if (different) { mask[p] = 1; changed++; }
            }
            if ((y + 1) % 64 === 0 || y === height - 1) {
                options.onProgress?.((y + 1) / height);
                await (options.yieldTask ? options.yieldTask() : new Promise(resolve => setTimeout(resolve, 0)));
            }
        }
        options.check?.();
        return { mask, changed, total, percent: changed / total * 100 };
    }
    function overlay(base, mask, opacity = .3, layerOnly = false) {
        if (base.length !== mask.length * 4 || !Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new Error('重ね表示の設定が不正です。');
        const data = new Uint8ClampedArray(base.length), red = [235, 55, 65];
        for (let p = 0; p < mask.length; p++) {
            const i = p * 4;
            if (layerOnly) {
                if (mask[p]) { data.set(red, i); data[i+3] = Math.round(opacity * 255); }
                continue;
            }
            for (let c = 0; c < 3; c++) { const color = visible(base[i+c],base[i+3]); data[i+c] = mask[p] ? Math.round(color * (1-opacity) + red[c] * opacity) : color; }
            data[i+3] = 255;
        }
        return data;
    }
    function formatPercent(percent) { return percent > 0 && percent < .01 ? '< 0.01' : percent.toFixed(2); }
    const api = { LIMITS, layout, compare, overlay, formatPercent };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ImageCompareCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

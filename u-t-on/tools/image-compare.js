(function () {
    'use strict';
    const C = globalThis.ImageCompareCore;
    const $ = id => document.getElementById(id);
    const ui = Object.fromEntries(['fileA','fileB','thumbA','thumbB','infoA','infoB','sampleBtn','clearBtn','tolerance','toleranceValue','sizeInfo','compareBtn','cancelBtn','status','progress','result','percent','counts','resultNote','viewDiff','viewA','viewB','opacity','opacityValue','diffOnly','actualSize','viewLabel','canvasWrap','resultCanvas','downloadBtn'].map(id => [id, $(id)]));
    const sources = { A: null, B: null };
    let result = null, busy = false, cancelled = false, view = 'diff', renderRequest = 0;
    const supported = typeof createImageBitmap === 'function';
    function status(text, error = false) { ui.status.textContent = text; ui.status.classList.toggle('error', error); }
    function check() { if (cancelled) throw new DOMException('処理を中止しました。', 'AbortError'); }
    function setBusy(value) {
        busy = value;
        for (const id of ['fileA','fileB','sampleBtn','clearBtn','tolerance','opacity','diffOnly','actualSize','viewDiff','viewA','viewB','downloadBtn']) ui[id].disabled = value || !supported;
        ui.compareBtn.disabled = value || !supported || !sources.A || !sources.B;
        ui.cancelBtn.hidden = !value; ui.cancelBtn.disabled = false;
        if (!value) ui.progress.hidden = true;
    }
    async function operation(fn) {
        if (busy) return;
        cancelled = false; setBusy(true);
        try { await fn(); }
        catch (error) { status(error.name === 'AbortError' ? '処理を中止しました。' : `処理できませんでした：${error.message || '画像を確認してください。'}`, error.name !== 'AbortError'); }
        finally { setBusy(false); }
    }
    function invalidate() {
        if (renderRequest) cancelAnimationFrame(renderRequest);
        renderRequest = 0; result = null; ui.result.hidden = true;
        ui.resultCanvas.width = ui.resultCanvas.height = 1;
    }
    function releaseSource(key) {
        if (sources[key]) URL.revokeObjectURL(sources[key].thumbUrl);
        sources[key] = null; ui['thumb'+key].hidden = true; ui['thumb'+key].removeAttribute('src');
        ui['info'+key].textContent = 'まだ選択されていません';
    }
    function clear() {
        invalidate(); releaseSource('A'); releaseSource('B');
        ui.fileA.value = ui.fileB.value = ''; updateSize();
    }
    function updateSize() {
        if (!sources.A || !sources.B) { ui.sizeInfo.textContent = '左上をそろえて比較します。片方にしかない領域も差分に含めます。'; return; }
        const g = C.layout(sources.A, sources.B);
        ui.sizeInfo.textContent = `比較範囲 ${g.width.toLocaleString()} × ${g.height.toLocaleString()}px / 左上をそろえて比較` +
            (g.scale < 1 ? `\n大きな画像のため、2枚とも約${(g.scale * 100).toFixed(1)}%に縮小します。差分率は縮小後の画像で計算します。` : '\n元のピクセルで比較します。サイズが違う場合、片方にしかない領域も差分です。');
    }
    function toBlob(canvas) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNGの保存に失敗しました。')), 'image/png')); }
    async function decode(file) {
        try { return await createImageBitmap(file); }
        catch { throw new Error('画像を読み込めませんでした。壊れていないPNG・JPEG・WebPを選んでください。'); }
    }
    async function load(file, key) {
        invalidate();
        if (file.size > C.LIMITS.fileBytes) throw new Error('画像は1枚30MB以下にしてください。');
        if (!/\.(png|jpe?g|webp)$/i.test(file.name) && !['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('PNG・JPEG・WebPの静止画を選んでください。');
        status(`画像${key}を読み込んでいます…`);
        const bitmap = await decode(file);
        let canvas;
        try {
            check();
            if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > C.LIMITS.sourcePixels) throw new Error('入力画像は2,400万画素以下にしてください。');
            const factor = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
            canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * factor)); canvas.height = Math.max(1, Math.round(bitmap.height * factor));
            const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('描画用メモリを確保できません。');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await toBlob(canvas); check();
            releaseSource(key);
            sources[key] = { file, width: bitmap.width, height: bitmap.height, thumbUrl: URL.createObjectURL(blob) };
            ui['thumb'+key].src = sources[key].thumbUrl; ui['thumb'+key].hidden = false;
            ui['info'+key].textContent = `${file.name} · ${bitmap.width.toLocaleString()} × ${bitmap.height.toLocaleString()}px · ${(file.size / 1024 / 1024).toFixed(2)}MB`;
            updateSize();
            status(sources.A && sources.B ? '2枚の画像がそろいました。「比較する」を押してください。' : 'もう1枚の画像を選んでください。');
        } finally { bitmap.close(); if (canvas) canvas.width = canvas.height = 1; }
    }
    async function pixels(source, width, height, grid) {
        const canvas = document.createElement('canvas'); canvas.width = grid.width; canvas.height = grid.height;
        let bitmap;
        try {
            bitmap = await decode(source.file); check();
            const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('描画用メモリを確保できません。');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, grid.width, grid.height);
            ctx.drawImage(bitmap, 0, 0, width, height);
            return ctx.getImageData(0, 0, grid.width, grid.height).data;
        } finally { bitmap?.close(); canvas.width = canvas.height = 1; }
    }
    function put(canvas, bytes, grid) {
        if (canvas.width !== grid.width) canvas.width = grid.width;
        if (canvas.height !== grid.height) canvas.height = grid.height;
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('描画用メモリを確保できません。');
        const image = ctx.createImageData(grid.width, grid.height); image.data.set(bytes); ctx.putImageData(image, 0, 0);
    }
    function render() {
        renderRequest = 0; if (!result) return;
        const bytes = view === 'A' ? result.a : view === 'B' ? result.b : C.overlay(result.b, result.mask, Number(ui.opacity.value) / 100, ui.diffOnly.checked);
        put(ui.resultCanvas, bytes, result.grid);
        for (const [id, active] of [['viewDiff',view === 'diff'],['viewA',view === 'A'],['viewB',view === 'B']]) ui[id].setAttribute('aria-pressed', String(active));
        ui.downloadBtn.textContent = ui.diffOnly.checked ? '差分レイヤーをPNG保存' : '赤い差分画像をPNG保存';
        ui.viewLabel.textContent = view === 'diff' ? (ui.diffOnly.checked ? '元画像を隠して、差分の赤いレイヤーだけを白背景で表示しています。' : '画像Bに、差分のある部分を薄い赤で重ねています。') : `画像${view}を表示しています。比較範囲外の余白は白で表示します。`;
        ui.canvasWrap.classList.toggle('is-actual', ui.actualSize.checked);
    }
    async function compare() {
        if (!sources.A || !sources.B) throw new Error('2枚の画像を選んでください。');
        invalidate(); const grid = C.layout(sources.A, sources.B), tolerance = Number(ui.tolerance.value);
        status('比較用の画像を準備しています…');
        // Decode sequentially and close each bitmap before reading the next image.
        const a = await pixels(sources.A, grid.aw, grid.ah, grid); check();
        const b = await pixels(sources.B, grid.bw, grid.bh, grid); check();
        ui.progress.hidden = false; ui.progress.value = 0; status('画素を比較しています…');
        const comparison = await C.compare(a, b, grid, tolerance, { check, onProgress: n => { ui.progress.value = n; } }); check();
        result = { ...comparison, grid, a, b, tolerance }; view = 'diff';
        const unit = document.createElement('span'); unit.textContent = '%';
        ui.percent.replaceChildren(document.createTextNode(C.formatPercent(result.percent)), unit);
        ui.counts.textContent = `差分 ${result.changed.toLocaleString()}画素\n比較対象 ${result.total.toLocaleString()}画素`;
        ui.resultNote.textContent = `${grid.width.toLocaleString()} × ${grid.height.toLocaleString()}px / 許容値 ${tolerance} / 透明部分は白背景で比較` + (grid.scale < 1 ? `\n縮小後の画像での差分率です（元画像の約${(grid.scale * 100).toFixed(1)}%の大きさ）。` : '\n元のピクセルで比較した結果です。');
        ui.result.hidden = false; render(); status(`比較しました。差分率は${C.formatPercent(result.percent)}%です。`);
    }
    for (const key of ['A','B']) {
        ui['file'+key].addEventListener('change', () => { const file = ui['file'+key].files[0]; ui['file'+key].value = ''; if (file) operation(() => load(file, key)); });
        const drop = $('drop'+key);
        for (const eventName of ['dragover','dragleave','drop']) drop.addEventListener(eventName, event => {
            event.preventDefault(); drop.classList.toggle('dragover', eventName === 'dragover');
            if (eventName === 'drop' && !busy && supported && event.dataTransfer.files[0]) operation(() => load(event.dataTransfer.files[0], key));
        });
    }
    ui.compareBtn.addEventListener('click', () => operation(compare));
    ui.cancelBtn.addEventListener('click', () => { cancelled = true; ui.cancelBtn.disabled = true; status('中止しています…'); });
    ui.clearBtn.addEventListener('click', () => { if (!busy) { clear(); setBusy(false); status('画像と結果を消去しました。'); } });
    ui.sampleBtn.addEventListener('click', () => operation(async () => {
        clear(); ui.tolerance.value = '20'; ui.toleranceValue.textContent = '20'; status('サンプル画像を読み込んでいます…');
        for (const key of ['A','B']) {
            const response = await fetch(`../common/examples/compare-${key.toLowerCase()}.png`); if (!response.ok) throw new Error('サンプル画像を取得できませんでした。');
            const blob = await response.blob(); check(); await load(new File([blob], `sample-${key}.png`, { type: 'image/png' }), key);
        }
        status('イラストのサンプルを読み込みました。細かな色の揺らぎを除外するため許容値20を設定しています。「比較する」を押してください。');
    }));
    ui.tolerance.addEventListener('input', () => { ui.toleranceValue.textContent = ui.tolerance.value === '0' ? '0（完全一致で比較）' : ui.tolerance.value; invalidate(); if (sources.A && sources.B) status('許容値を変更しました。「比較する」を押してください。'); });
    for (const [id, value] of [['viewDiff','diff'],['viewA','A'],['viewB','B']]) ui[id].addEventListener('click', () => { view = value; if (value !== 'diff') ui.diffOnly.checked = false; render(); });
    ui.opacity.addEventListener('input', () => { ui.opacityValue.textContent = `${ui.opacity.value}%`; if (!renderRequest && result && view === 'diff') renderRequest = requestAnimationFrame(render); });
    ui.diffOnly.addEventListener('change', () => { if (ui.diffOnly.checked) view = 'diff'; render(); });
    ui.actualSize.addEventListener('change', () => { ui.canvasWrap.classList.toggle('is-actual', ui.actualSize.checked); });
    ui.downloadBtn.addEventListener('click', () => operation(async () => {
        if (!result) throw new Error('先に比較してください。');
        const canvas = document.createElement('canvas');
        try { put(canvas, C.overlay(result.b, result.mask, Number(ui.opacity.value) / 100, ui.diffOnly.checked), result.grid); const blob = await toBlob(canvas); check(); ToolUtils.downloadBlob(blob, ui.diffOnly.checked ? 'image-diff-layer.png' : 'image-diff.png'); status(ui.diffOnly.checked ? '差分レイヤーを背景が透明のPNGで保存しました。' : '赤い差分画像をPNGで保存しました。'); }
        finally { canvas.width = canvas.height = 1; }
    }));
    window.addEventListener('pagehide', () => { cancelled = true; clear(); });
    setBusy(false);
    if (!supported) status('このブラウザでは画像比較を利用できません。画像の読み込みに対応した新しいブラウザでお試しください。', true);
})();

import { Input, BlobSource, MP4, QTFF, WEBM, EncodedPacketSink, VideoSampleSink } from '../common/vendor/mediabunny-1.65.0.min.mjs';

const C = globalThis.VideoFramesCore;
const $ = id => document.getElementById(id);
const ui = Object.fromEntries(['videoInput','sampleBtn','resetBtn','fileInfo','editor','settings','settingsFields','scrubber','framePosition','prevBtn','nextBtn','saveFrameBtn','setStartBtn','setEndBtn','mode','interval','intervalField','start','end','maxSide','format','quality','qualityField','fullRangeBtn','planInfo','extractBtn','cancelBtn','progress','status','results','resultInfo','gallery','zipBtn','sheetBtn','csvBtn','continueBtn','clearBtn','preview','selectedZipBtn','selectAllBtn','deselectAllBtn','selectionInfo','galleryPrevBtn','galleryNextBtn'].map(id => [id, $(id)]));
let media = null, output = [], outputBytes = 0, position = 0, busy = false, cancelled = false, continuation = null;
const selected = new Set();
let outputSettings = null;
const ready = isSecureContext && typeof VideoDecoder !== 'undefined';
const capability = $('capability');
capability.textContent = ready ? '動画はこの端末内で処理します。動画ファイルのアップロードはありません。' : 'このブラウザでは全フレーム抽出を利用できません。WebCodecs対応ブラウザをHTTPSで開いてください。';
capability.classList.toggle('error', !ready);
ui.videoInput.disabled = ui.sampleBtn.disabled = !ready;
function status(message, error = false) { ui.status.textContent = message; ui.status.classList.toggle('error', error); }
function check() { if (cancelled) throw new DOMException('処理を中止しました。', 'AbortError'); }
function setBusy(value) {
    busy = value;
    for (const id of ['videoInput','sampleBtn','resetBtn','scrubber','prevBtn','nextBtn','saveFrameBtn','setStartBtn','setEndBtn','extractBtn','zipBtn','sheetBtn','csvBtn','continueBtn','clearBtn']) ui[id].disabled = value || (!ready && ['videoInput','sampleBtn'].includes(id));
    updateSelection();
    ui.settingsFields.disabled = value;
    ui.cancelBtn.hidden = !value;
    ui.cancelBtn.disabled = false;
    if (!value) { ui.progress.hidden = true; updatePlan(); updateNavigation(); }
}
async function operation(fn) {
    if (busy) return;
    cancelled = false; setBusy(true);
    try { await fn(); }
    catch (error) { status(error.name === 'AbortError' ? '処理を中止しました。' + (output.length ? '抽出済みの結果は保存できます。' : '') : `処理できませんでした：${error.message || '動画の形式・範囲を確認してください。'}`, error.name !== 'AbortError'); }
    finally { setBusy(false); }
}
function updateNavigation() {
    ui.prevBtn.disabled = busy || !media || position <= 0;
    ui.nextBtn.disabled = busy || !media || position >= media.frames.length - 1;
}
function currentPlan() {
    return C.plan(media.frames, Number(ui.start.value), Number(ui.end.value), ui.mode.value, Number(ui.interval.value));
}
function updatePlan() {
    ui.intervalField.hidden = ui.mode.value !== 'interval'; ui.qualityField.hidden = ui.format.value !== 'jpeg';
    if (!media) return;
    try {
        const plan = currentPlan(), dims = C.size(media.width, media.height, Number(ui.maxSide.value));
        ui.planInfo.textContent = `${plan.total.toLocaleString()}枚の対象 → 今回 ${plan.frames.length}枚 / ${dims.width} × ${dims.height}px` + (plan.next !== null ? '\n残りは保存後に「続きの200枚」で取り出せます。間引きはしません。' : '');
        ui.extractBtn.disabled = busy || !plan.frames.length;
    } catch (error) { ui.planInfo.textContent = error.message; ui.extractBtn.disabled = true; }
}
function clearOutput() {
    for (const f of output) { URL.revokeObjectURL(f.url); URL.revokeObjectURL(f.thumbUrl); }
    output = []; outputBytes = 0; continuation = null; outputSettings = null;
    selected.clear();
    ui.gallery.replaceChildren(); ui.results.hidden = true; ui.continueBtn.hidden = true;
    ui.gallery.scrollLeft = 0; updateSelection();
}
function releaseMedia() { media?.input.dispose(); media = null; ui.editor.hidden = ui.settings.hidden = true; ui.fileInfo.textContent = ''; }
function blobFromCanvas(canvas, type, quality) {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('画像の保存に失敗しました。小さいサイズを選んでください。')), type, quality));
}
function canvasOf(sample, side, jpeg = false) {
    const dims = C.size(sample.displayWidth, sample.displayHeight, side), canvas = document.createElement('canvas');
    canvas.width = dims.width; canvas.height = dims.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('描画用メモリが足りません。');
    if (jpeg) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    sample.draw(ctx, 0, 0, canvas.width, canvas.height);
    return canvas;
}
function matches(sample, frame) { return Math.abs(sample.timestamp - frame.timestamp) <= 0.00000051; }
async function exactSample(frame) {
    // Query just after the original PTS: rounding it down can select the preceding packet.
    const sample = await new VideoSampleSink(media.track).getSample(frame.timestamp + 0.00000051);
    if (!sample || !matches(sample, frame)) { sample?.close(); throw new Error('指定コマを正確に復元できませんでした。この動画の圧縮方式には対応していない可能性があります。'); }
    return sample;
}
async function showFrame(index) {
    position = Math.max(0, Math.min(media.frames.length - 1, index));
    const frame = media.frames[position], sample = await exactSample(frame);
    try {
        check();
        const dims = C.size(sample.displayWidth, sample.displayHeight, 1280), canvas = ui.preview;
        canvas.width = dims.width; canvas.height = dims.height;
        sample.draw(canvas.getContext('2d'), 0, 0, dims.width, dims.height);
        ui.scrubber.value = position;
        ui.framePosition.textContent = `${position + 1} / ${media.frames.length.toLocaleString()}コマ · ${frame.time.toFixed(6)}秒`;
    } finally { sample.close(); }
}
async function openFile(file) {
    if (!file) return;
    clearOutput(); releaseMedia(); ui.resetBtn.hidden = true;
    if (file.size > C.LIMITS.file) throw new Error('動画は512MB以下にしてください。');
    status('動画を解析中… フレームの時刻を調べています。');
    const input = new Input({ source: new BlobSource(file, { maxCacheSize: 4 * 1024 * 1024 }), formats: [MP4, QTFF, WEBM] });
    try {
        const track = await input.getPrimaryVideoTrack(); check();
        if (!track) throw new Error('映像トラックがありません。MP4・MOV・WebMの動画を選んでください。');
        const [width, height, codedWidth, codedHeight] = await Promise.all([track.getDisplayWidth(),track.getDisplayHeight(),track.getCodedWidth(),track.getCodedHeight()]);
        if (Math.max(width, height, codedWidth, codedHeight) > 4096 || Math.max(width * height, codedWidth * codedHeight) > C.LIMITS.pixels) throw new Error('入力解像度が上限を超えています。長辺4,096px・約884万画素以下の動画をご利用ください。');
        if (!await track.canDecode()) throw new Error('このブラウザでは映像の圧縮方式を復元できません。別の対応ブラウザかH.264のMP4などでお試しください。');
        const packets = [];
        for await (const packet of new EncodedPacketSink(track).packets(undefined, undefined, { metadataOnly: true })) {
            check();
            if (packets.length >= C.LIMITS.packets) throw new Error('12万コマを超える動画は読み込めません。動画を短く分割してください。');
            packets.push({ timestamp: packet.timestamp, duration: packet.duration });
            if (packets.length % 256 === 0) { status(`${packets.length.toLocaleString()}コマの時刻を確認中…`); await new Promise(resolve => setTimeout(resolve, 0)); }
        }
        check();
        const frames = C.timeline(packets), duration = frames.at(-1).time + (frames.at(-1).duration || (frames.length > 1 ? frames.at(-1).time - frames.at(-2).time : 1 / 30));
        if (!Number.isFinite(duration) || duration <= 0) throw new Error('動画の長さを取得できません。');
        media = { input, track, file, width, height, frames, duration };
        position = 0; ui.scrubber.max = frames.length - 1; ui.scrubber.value = 0;
        ui.start.value = '0'; ui.end.value = String(duration);
        ui.fileInfo.textContent = `${file.name} · ${width} × ${height}px · ${duration.toFixed(3)}秒 · ${frames.length.toLocaleString()}コマ`;
        ui.editor.hidden = ui.settings.hidden = false; ui.resetBtn.hidden = false;
        await showFrame(0); check(); updatePlan();
        status('準備できました。範囲を選んで分解するか、コマ送りで確認できます。');
    } catch (error) { input.dispose(); media = null; ui.editor.hidden = ui.settings.hidden = true; ui.fileInfo.textContent = ''; throw error; }
}
function addCard(f) {
    const figure = document.createElement('figure'), img = document.createElement('img'), caption = document.createElement('figcaption'), link = document.createElement('a');
    const label = document.createElement('label'), checkbox = document.createElement('input'), badge = document.createElement('span');
    label.className = 'vf-frame-select'; checkbox.type = 'checkbox'; checkbox.dataset.frameIndex = f.index;
    checkbox.setAttribute('aria-label', `${f.index + 1}コマ目（${f.time.toFixed(6)}秒）を選択`);
    checkbox.disabled = busy; badge.className = 'vf-select-badge'; badge.textContent = '選ぶ';
    checkbox.addEventListener('change', () => {
        if (busy) { checkbox.checked = selected.has(f.index); return; }
        if (checkbox.checked) selected.add(f.index); else selected.delete(f.index);
        updateSelection();
    });
    img.src = f.thumbUrl; img.width = f.thumbWidth; img.height = f.thumbHeight; img.alt = `${f.index + 1}コマ目`; img.loading = 'lazy';
    caption.append(document.createTextNode(`#${f.index + 1} · ${f.time.toFixed(6)}秒`), document.createElement('br'));
    link.textContent = '画像を保存 ↓'; link.href = f.url; link.download = f.name;
    label.append(img, checkbox, badge); caption.append(link); figure.append(label, caption); ui.gallery.append(figure);
}
function updateSelection() {
    ui.selectionInfo.textContent = `${selected.size} / ${output.length}枚を選択中`;
    ui.selectedZipBtn.textContent = `選択した${selected.size}枚をZIP保存`;
    ui.selectedZipBtn.disabled = busy || !selected.size;
    ui.selectAllBtn.disabled = busy || !output.length || selected.size === output.length;
    ui.deselectAllBtn.disabled = busy || !selected.size;
    for (const checkbox of ui.gallery.querySelectorAll('input[type="checkbox"]')) {
        const checked = selected.has(Number(checkbox.dataset.frameIndex));
        checkbox.checked = checked; checkbox.disabled = busy;
        checkbox.closest('figure').classList.toggle('is-selected', checked);
        checkbox.nextElementSibling.textContent = checked ? '選択中' : '選ぶ';
    }
}
function updateResults() {
    ui.results.hidden = !output.length;
    ui.resultInfo.textContent = `${output.length}枚 · ${(outputBytes / 1024 / 1024).toFixed(2)}MB · ${outputSettings?.format === 'jpeg' ? 'JPEG' : 'PNG'} / 時刻表付き`;
    ui.continueBtn.hidden = continuation === null;
    updateSelection();
}
async function encodeSample(sample, frame, settings) {
    const canvas = canvasOf(sample, settings.side, settings.format === 'jpeg');
    let blob, thumb, thumbBlob;
    try {
        blob = await blobFromCanvas(canvas, `image/${settings.format}`, settings.quality);
        check();
        if (outputBytes + blob.size > C.LIMITS.bytes) return null;
        thumb = document.createElement('canvas'); const dims = C.size(canvas.width, canvas.height, 160);
        thumb.width = dims.width; thumb.height = dims.height; thumb.getContext('2d').drawImage(canvas, 0, 0, dims.width, dims.height);
        thumbBlob = await blobFromCanvas(thumb, 'image/jpeg', 0.65); check();
        return { ...frame, blob, width: canvas.width, height: canvas.height, name: C.filename(frame, settings.format === 'jpeg' ? 'jpg' : 'png'), thumbBlob, thumbWidth: dims.width, thumbHeight: dims.height };
    } finally { canvas.width = canvas.height = 1; if (thumb) thumb.width = thumb.height = 1; }
}
async function extract(nextBatch = false) {
    const plan = nextBatch ? continuation : currentPlan();
    if (!plan?.frames.length) throw new Error('抽出対象のコマがありません。');
    const settings = nextBatch ? outputSettings : { side: Number(ui.maxSide.value), format: ui.format.value, quality: Number(ui.quality.value) };
    // Carry the entire remaining plan by original indices. Settings edits never alter a continuation.
    const remaining = plan.remaining;
    const batch = remaining.slice(0, C.LIMITS.frames);
    clearOutput(); outputSettings = settings;
    let completed = 0, capacity = false, succeeded = false;
    ui.progress.hidden = false; ui.progress.max = batch.length; ui.progress.value = 0;
    status(`分解中… 0 / ${batch.length}枚`);
    const first = batch[0], last = batch.at(-1), wanted = new Map(batch.map(f => [Math.round(f.timestamp * 1e6), f]));
    try {
        const sink = new VideoSampleSink(media.track);
        const sparse = batch.some((f, i) => i && f.index !== batch[i - 1].index + 1);
        const samples = sparse ? sink.samplesAtTimestamps(batch.map(f => f.timestamp + 0.00000051)) : sink.samples(first.timestamp - 0.000001, last.timestamp + 0.000001);
        for await (const sample of samples) {
            if (!sample) throw new Error('対象のコマを復元できませんでした。抽出済みの分のみ保存できます。');
            try {
                check();
                const frame = wanted.get(Math.round(sample.timestamp * 1e6));
                if (!frame) continue;
                if (!matches(sample, batch[completed])) throw new Error('復元したコマの順序が一致しません。全コマ抽出を保証できないため停止しました。');
                const encoded = await encodeSample(sample, frame, settings);
                if (!encoded) { capacity = true; break; }
                const f = { ...encoded, url: URL.createObjectURL(encoded.blob), thumbUrl: URL.createObjectURL(encoded.thumbBlob) };
                output.push(f); outputBytes += f.blob.size; completed++;
                addCard(f); ui.progress.value = completed; updateResults();
                status(`分解中… ${completed} / ${batch.length}枚`);
                await new Promise(resolve => setTimeout(resolve, 0));
                if (completed === batch.length) break;
            } finally { sample.close(); }
        }
        check();
        if (!capacity && completed !== batch.length) throw new Error(`予定${batch.length}枚に対し${completed}枚しか復元できませんでした。抽出済みの分のみ保存できます。`);
        succeeded = true;
        status(capacity ? `96MBの上限に達したため${completed}枚で停止しました。保存後に続きから処理するか、JPEG・小さいサイズでやり直してください。` : `${completed}枚を分解しました。画像と時刻表を保存できます。`);
    } finally {
        const rest = remaining.slice(completed);
        if (rest.length && (succeeded || cancelled) && completed > 0) continuation = { frames: rest.slice(0, C.LIMITS.frames), remaining: rest };
        updateResults();
    }
}

ui.videoInput.addEventListener('change', () => { const file = ui.videoInput.files[0]; ui.videoInput.value = ''; operation(() => openFile(file)); });
const dropZone = $('dropZone');
for (const name of ['dragover','dragleave','drop']) dropZone.addEventListener(name, event => {
    event.preventDefault(); dropZone.classList.toggle('dragover', name === 'dragover');
    if (name === 'drop' && !busy && ready) operation(() => openFile(event.dataTransfer.files[0]));
});
ui.sampleBtn.addEventListener('click', () => operation(async () => {
    status('サンプル動画を読み込んでいます…');
    const response = await fetch('../common/examples/video-frames-sample.mp4');
    if (!response.ok) throw new Error('サンプル動画を取得できませんでした。');
    const blob = await response.blob(); check();
    await openFile(new File([blob], 'sample-motion.mp4', { type: 'video/mp4' }));
}));
ui.cancelBtn.addEventListener('click', () => { cancelled = true; ui.cancelBtn.disabled = true; status('中止しています…'); });
ui.resetBtn.addEventListener('click', () => { if (busy) return; clearOutput(); releaseMedia(); ui.preview.width = ui.preview.height = 1; ui.resetBtn.hidden = true; status('動画と結果を消去しました。'); });
ui.scrubber.addEventListener('change', () => operation(() => showFrame(Number(ui.scrubber.value))));
ui.prevBtn.addEventListener('click', () => operation(() => showFrame(position - 1)));
ui.nextBtn.addEventListener('click', () => operation(() => showFrame(position + 1)));
ui.setStartBtn.addEventListener('click', () => { ui.start.value = String(media.frames[position].time); updatePlan(); });
ui.setEndBtn.addEventListener('click', () => { ui.end.value = String(media.frames[position + 1]?.time ?? media.duration); updatePlan(); });
ui.fullRangeBtn.addEventListener('click', () => { ui.start.value = 0; ui.end.value = String(media.duration); updatePlan(); });
ui.settingsFields.addEventListener('input', updatePlan); ui.settingsFields.addEventListener('change', updatePlan);
ui.extractBtn.addEventListener('click', () => operation(() => extract()));
ui.continueBtn.addEventListener('click', () => operation(() => extract(true)));
ui.clearBtn.addEventListener('click', () => { clearOutput(); status('抽出結果を消去しました。動画はそのまま使えます。'); });
ui.saveFrameBtn.addEventListener('click', () => operation(async () => {
    const frame = media.frames[position], sample = await exactSample(frame);
    let canvas;
    try {
        check(); canvas = canvasOf(sample, Number(ui.maxSide.value), ui.format.value === 'jpeg');
        const blob = await blobFromCanvas(canvas, `image/${ui.format.value}`, Number(ui.quality.value)); check();
        ToolUtils.downloadBlob(blob, C.filename(frame, ui.format.value === 'jpeg' ? 'jpg' : 'png'));
        status(`${position + 1}コマ目を保存しました。`);
    } finally { sample.close(); if (canvas) canvas.width = canvas.height = 1; }
}));
async function saveZip(frames, selectedOnly = false) {
    if (!frames.length) throw new Error('保存するコマを選んでください。');
    status('ZIPを作成しています…');
    const entries = frames.map(f => ({ name: f.name, blob: f.blob }));
    entries.push({ name: 'frames.csv', blob: new Blob(['\ufeff', C.manifest(frames)], { type: 'text/csv;charset=utf-8' }) });
    const blob = await C.zip(entries, check); check();
    ToolUtils.downloadBlob(blob, selectedOnly ? 'video-frames-selected.zip' : 'video-frames.zip');
    status(`${selectedOnly ? '選択した' : '全'}${frames.length}枚のZIPを保存しました。対象の画像とframes.csvが入っています。`);
}
ui.zipBtn.addEventListener('click', () => operation(() => saveZip([...output])));
ui.selectedZipBtn.addEventListener('click', () => operation(() => saveZip(output.filter(f => selected.has(f.index)), true)));
ui.selectAllBtn.addEventListener('click', () => { if (busy) return; for (const f of output) selected.add(f.index); updateSelection(); });
ui.deselectAllBtn.addEventListener('click', () => { if (busy) return; selected.clear(); updateSelection(); });
for (const [button, direction] of [[ui.galleryPrevBtn, -1], [ui.galleryNextBtn, 1]]) {
    button.addEventListener('click', () => ui.gallery.scrollBy({ left: direction * Math.max(180, ui.gallery.clientWidth * .8), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
}
ui.csvBtn.addEventListener('click', () => ToolUtils.downloadBlob(new Blob(['\ufeff', C.manifest(output)], { type: 'text/csv;charset=utf-8' }), 'frames.csv'));
ui.sheetBtn.addEventListener('click', () => operation(async () => {
    status('一覧画像を作成しています…');
    const columns = Math.min(5, output.length), cellW = 200, cellH = 146, canvas = document.createElement('canvas');
    canvas.width = columns * cellW; canvas.height = Math.ceil(output.length / columns) * cellH;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    try {
        for (let i = 0; i < output.length; i++) {
            check(); const f = output[i], bitmap = await createImageBitmap(f.thumbBlob);
            const x = (i % columns) * cellW, y = Math.floor(i / columns) * cellH;
            try {
                const scale = Math.min(184 / bitmap.width, 108 / bitmap.height);
                ctx.drawImage(bitmap, x + (cellW - bitmap.width * scale) / 2, y + 8 + (108 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
                ctx.fillStyle = '#29494a'; ctx.font = '12px sans-serif'; ctx.fillText(`#${f.index + 1}  ${f.time.toFixed(6)}s`, x + 8, y + 135);
            } finally { bitmap.close(); }
            if (i % 10 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        }
        const blob = await blobFromCanvas(canvas, 'image/jpeg', 0.85); check(); ToolUtils.downloadBlob(blob, 'video-contact-sheet.jpg'); status('一覧画像を保存しました。');
    } finally { canvas.width = canvas.height = 1; }
}));
window.addEventListener('pagehide', () => { cancelled = true; clearOutput(); media?.input.dispose(); });

// --- 1. SEO・メタタグ設定（seo-config.jsから取得） ---
const currentToolId = "image-joiner";
if (typeof SEO_CONFIG !== 'undefined' && SEO_CONFIG[currentToolId]) {
    const data = SEO_CONFIG[currentToolId];
    document.title = data.title;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
    }
    metaDesc.content = data.description;
}

const toolExplanations = {
    step1_upload: {
        title: "画像のアップロード",
        body: "結合したい画像をフォルダから選択、またはこのエリアにドラッグ＆ドロップしてください。\n\n【対応形式】\nJPG / PNG / WebP はもちろん、iPhoneで一般的な HEIC 形式や、高画質な TIFF 形式にも対応しています。一度に複数の画像を選択してまとめて読み込ませることも可能です。\n\n⚠️ 動作が重い場合は、「プレビューを軽量化」をオンにしてから読み込んでください。"
    },
    step2_sort: {
        title: "並び替え・削除",
        body: "読み込んだ画像は、サムネイルをタップして選択状態にできます。\n\n【操作方法】\n左右の矢印ボタン（▲）で1つずつ移動、または数値を入力して「移動」ボタンを押すと好きな位置へ一気に飛ばせます。不要な画像はゴミ箱アイコンで削除してください。"
    },
    step3_direction: {
        title: "結合の方向",
        body: "画像を「縦」に並べるか「横」に並べるかを選択します。\n\n【使い分けのヒント】\nSNS投稿などには「縦」、パノラマ写真などには「横」がおすすめです。"
    },
    step4_bgcolor: {
        title: "背景色・透過",
        body: "画像同士の隙間や、サイズが異なる場合に生じる余白の色を設定します。\n※透過を維持するには、保存形式で PNG または WebP を選択してください。"
    },
    step5_sync: {
        title: "サイズの同期",
        body: "大きさがバラバラな画像を結合する際、幅（または高さ）を自動で揃える機能です。"
    },
    step6_format: {
        title: "保存形式",
        body: "書き出すファイルの形式を選択します。JPEGは透過に非対応です。"
    },
    step7_preview: {
        title: "プレビュー操作",
        body: "生成された結合画像を自由に拡大・縮小して確認できます。\n\n【軽量化モード】\nオンにして読み込むと、メモリ消費を劇的に抑えるため解像度を制限します。大量の画像を扱う場合に有効です。"
    }
};

function initExplanations() {
    document.querySelectorAll('[data-explain-id]').forEach(el => {
        const id = el.getAttribute('data-explain-id');
        if (toolExplanations[id]) el.innerText = toolExplanations[id].body;
    });
    document.querySelectorAll('[data-explain-block]').forEach(el => {
        const id = el.getAttribute('data-explain-block');
        const data = toolExplanations[id];
        if (data) {
            el.innerHTML = `<h3 class="font-bold text-blue-600 mb-2 flex items-center gap-2"><span class="w-1 h-4 bg-blue-600 rounded-full"></span>${data.title}</h3>
                <p class="text-sm text-gray-600 leading-relaxed">${data.body.replace(/\n/g, '<br>')}</p>`;
        }
    });
}

const imageInput = document.getElementById('imageInput');
const thumbContainer = document.getElementById('thumbContainer');
const sortSection = document.getElementById('sortSection');
const btnVertical = document.getElementById('btnVertical');
const btnHorizontal = document.getElementById('btnHorizontal');
const downloadBtn = document.getElementById('downloadBtn');
const generateBtn = document.getElementById('generateBtn');
const actionArea = document.getElementById('actionArea');
const formatSelect = document.getElementById('formatSelect');
const resultSection = document.getElementById('resultSection');
const resultCanvas = document.getElementById('resultCanvas');
const canvasSizeInfo = document.getElementById('canvasSizeInfo');
const bgColorInput = document.getElementById('bgColorInput');
const transparentCheck = document.getElementById('transparentCheck');
const syncSizeCheck = document.getElementById('syncSizeCheck');
const syncTypeSelect = document.getElementById('syncTypeSelect');
const deleteBtn = document.getElementById('deleteBtn');
const moveLeftBtn = document.getElementById('moveLeftBtn');
const moveRightBtn = document.getElementById('moveRightBtn');
const positionInput = document.getElementById('positionInput');
const applyPosBtn = document.getElementById('applyPosBtn');
const optimizeCheck = document.getElementById('optimize-check');
const progressArea = document.getElementById('progressArea');
const progressBar = document.getElementById('progressBar');
const progressStatus = document.getElementById('progressStatus');
const progressPercent = document.getElementById('progressPercent');

const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoom100Btn = document.getElementById('zoom100Btn');
const zoomFitBtn = document.getElementById('zoomFitBtn');

let loadedImages = [];
let currentDirection = 'vertical';
let selectedIndex = null;
let currentZoom = 1.0;
const ZOOM_STEP = 0.1;

const updateProgress = (text, percent) => {
    if (progressStatus) progressStatus.innerText = text;
    if (progressPercent) progressPercent.innerText = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;
};

function applyZoom() {
    if (resultCanvas) {
        const displayWidth = resultCanvas.width * currentZoom;
        const displayHeight = resultCanvas.height * currentZoom;
        resultCanvas.style.width = `${displayWidth}px`;
        resultCanvas.style.height = `${displayHeight}px`;

        const wrapper = resultCanvas.parentElement;
        if (wrapper) {
            wrapper.style.height = "auto";
            wrapper.style.minHeight = "min-content";
            wrapper.style.width = "100%";
            wrapper.style.overflowX = "auto";
            wrapper.style.overflowY = "visible";
            resultCanvas.style.margin = (displayWidth < wrapper.clientWidth) ? "0 auto" : "0";
            resultCanvas.style.display = "block";
        }
    }
}

transparentCheck.addEventListener('change', () => { 
    bgColorInput.disabled = transparentCheck.checked; 
});

imageInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    loadedImages = [];
    selectedIndex = null;

    progressArea.classList.remove('hidden');
    generateBtn.disabled = true;
    const isOptimizeEnabled = optimizeCheck ? optimizeCheck.checked : false;

    for (let i = 0; i < files.length; i++) {
        updateProgress(`読込中 (${i + 1}/${files.length})`, Math.round(((i + 1) / files.length) * 100));
        let blob = files[i];
        const ext = blob.name.split('.').pop().toLowerCase();

        if (['heic', 'heif'].includes(ext)) {
            try {
                if (typeof heic2any !== 'undefined') {
                    const converted = await heic2any({ blob, toType: "image/jpeg", quality: 0.8 });
                    blob = Array.isArray(converted) ? converted[0] : converted;
                }
            } catch (err) { console.error(err); }
        }

        const imgData = await new Promise((resolve) => {
            const blobUrl = URL.createObjectURL(blob);
            const image = new Image();
            image.onload = () => {
                const oCanvas = document.createElement('canvas');
                oCanvas.width = image.width;
                oCanvas.height = image.height;
                oCanvas.getContext('2d').drawImage(image, 0, 0);

                const pLimit = 1000;
                let pScale = 1.0;
                if (oCanvas.width > pLimit || oCanvas.height > pLimit) {
                    pScale = pLimit / Math.max(oCanvas.width, oCanvas.height);
                }
                const pCanvas = document.createElement('canvas');
                pCanvas.width = oCanvas.width * pScale;
                pCanvas.height = oCanvas.height * pScale;
                pCanvas.getContext('2d').drawImage(oCanvas, 0, 0, pCanvas.width, pCanvas.height);
                
                URL.revokeObjectURL(blobUrl);

                resolve({ 
                    origImg: oCanvas,
                    previewImg: pCanvas, 
                    src: pCanvas.toDataURL('image/jpeg', 0.5),
                    w: image.width, 
                    h: image.height 
                });
            };
            image.src = blobUrl;
        });
        loadedImages.push(imgData);
    }
    
    renderThumbnails();
    sortSection.classList.remove('hidden');
    progressArea.classList.add('hidden');
    generateBtn.disabled = false;
});

function renderThumbnails() {
    thumbContainer.innerHTML = '';
    
    console.log(`現在の画像数: ${loadedImages.length}`);

    loadedImages.forEach((data, index) => {
        const thumb = document.createElement('img');
        thumb.src = data.src;
        thumb.className = `h-20 w-20 object-cover rounded cursor-pointer border-4 flex-shrink-0 transition-all ${selectedIndex === index ? 'border-blue-500 scale-105 shadow-md' : 'border-transparent hover:border-gray-200'}`;
        thumb.onclick = () => { selectedIndex = index; renderThumbnails(); };
        thumbContainer.appendChild(thumb);
    });

    if (loadedImages.length === 0) {
        sortSection.classList.add('hidden');
        imageInput.value = "";
    }
}

btnVertical.onclick = () => { 
    currentDirection = 'vertical'; 
    btnVertical.className = "flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-sm transition"; 
    btnHorizontal.className = "flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition"; 
};
btnHorizontal.onclick = () => { 
    currentDirection = 'horizontal'; 
    btnHorizontal.className = "flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-sm transition"; 
    btnVertical.className = "flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition"; 
};

moveLeftBtn.onclick = () => { if (selectedIndex > 0) { [loadedImages[selectedIndex - 1], loadedImages[selectedIndex]] = [loadedImages[selectedIndex], loadedImages[selectedIndex - 1]]; selectedIndex--; renderThumbnails(); } };
moveRightBtn.onclick = () => { if (selectedIndex !== null && selectedIndex < loadedImages.length - 1) { [loadedImages[selectedIndex + 1], loadedImages[selectedIndex]] = [loadedImages[selectedIndex], loadedImages[selectedIndex + 1]]; selectedIndex++; renderThumbnails(); } };
deleteBtn.onclick = () => { if (selectedIndex !== null && confirm("この画像を削除しますか？")) { loadedImages.splice(selectedIndex, 1); selectedIndex = null; renderThumbnails(); } };
applyPosBtn.onclick = () => {
    let n = parseInt(positionInput.value) - 1;
    if (selectedIndex !== null && !isNaN(n) && n >= 0 && n < loadedImages.length) {
        const item = loadedImages.splice(selectedIndex, 1)[0];
        loadedImages.splice(n, 0, item); selectedIndex = n; renderThumbnails();
    }
};

zoomInBtn.onclick = () => { currentZoom += ZOOM_STEP; applyZoom(); };
zoomOutBtn.onclick = () => { if (currentZoom > 0.05) { currentZoom -= ZOOM_STEP; applyZoom(); } };
zoom100Btn.onclick = () => { currentZoom = 1.0; applyZoom(); };
zoomFitBtn.onclick = () => {
    if (!resultCanvas || !resultCanvas.parentElement) return;
    const wrapper = resultCanvas.parentElement;
    const availableWidth = wrapper.clientWidth - 20;
    currentZoom = Math.min(availableWidth / resultCanvas.width, 1.0);
    applyZoom();
};

async function processImages(isFinalDownload = false) {
    if (loadedImages.length === 0) return;
    
    generateBtn.disabled = true; downloadBtn.disabled = true;
    progressArea.classList.remove('hidden');
    updateProgress(isFinalDownload ? "最高画質で生成中..." : "プレビュー中...", 10);
    
    const useOptimizedPreview = optimizeCheck ? optimizeCheck.checked : false;
    let targetData = loadedImages.map(d => ({ 
        img: (isFinalDownload || !useOptimizedPreview) ? d.origImg : d.previewImg, 
        w: d.w, h: d.h 
    }));

    if (syncSizeCheck.checked) {
        const isSmall = syncTypeSelect.value === 'small';
        if (currentDirection === 'vertical') {
            const targetW = isSmall ? Math.min(...targetData.map(i => i.w)) : Math.max(...targetData.map(i => i.w));
            targetData = targetData.map(item => ({ img: item.img, drawW: targetW, drawH: item.h * (targetW / item.w) }));
        } else {
            const targetH = isSmall ? Math.min(...targetData.map(i => i.h)) : Math.max(...targetData.map(i => i.h));
            targetData = targetData.map(item => ({ img: item.img, drawW: item.w * (targetH / item.h), drawH: targetH }));
        }
    } else {
        targetData = targetData.map(item => ({ img: item.img, drawW: item.w, drawH: item.h }));
    }

    let finalW = 0, finalH = 0;
    if (currentDirection === 'vertical') { finalW = Math.max(...targetData.map(i => i.drawW)); finalH = targetData.reduce((s, i) => s + i.drawH, 0); }
    else { finalW = targetData.reduce((s, i) => s + i.drawW, 0); finalH = Math.max(...targetData.map(i => i.drawH)); }

    const canvas = isFinalDownload ? document.createElement('canvas') : resultCanvas;
    canvas.width = finalW; canvas.height = finalH;
    const ctx = canvas.getContext('2d');

    if (!transparentCheck.checked) { ctx.fillStyle = bgColorInput.value; ctx.fillRect(0, 0, finalW, finalH); }
    else { ctx.clearRect(0, 0, finalW, finalH); }

    let offset = 0;
    for (let i = 0; i < targetData.length; i++) {
        const item = targetData[i];
        let x = currentDirection === 'vertical' ? (finalW - item.drawW) / 2 : offset;
        let y = currentDirection === 'vertical' ? offset : (finalH - item.drawH) / 2;
        ctx.drawImage(item.img, x, y, item.drawW, item.drawH);
        offset += (currentDirection === 'vertical' ? item.drawH : item.drawW);
        if (i % 5 === 0) { await new Promise(r => setTimeout(r, 0)); }
    }

    if (!isFinalDownload) {
        canvasSizeInfo.innerText = `出力予定サイズ: ${Math.round(finalW)} x ${Math.round(finalH)} px`;
        resultSection.classList.remove('hidden'); actionArea.classList.remove('hidden');
        progressArea.classList.add('hidden'); generateBtn.disabled = false; downloadBtn.disabled = false;
        setTimeout(() => zoomFitBtn.onclick(), 50);
    } else { return canvas; }
}

generateBtn.onclick = () => processImages(false);
downloadBtn.onclick = async () => {
    const finalCanvas = await processImages(true);
    const format = formatSelect.value;
    const ext = format === 'image/jpeg' ? 'jpg' : format.split('/')[1];
    finalCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `joined_${Date.now()}.${ext}`;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link);
        progressArea.classList.add('hidden'); generateBtn.disabled = false; downloadBtn.disabled = false;
    }, format, 0.85);
};

initExplanations();
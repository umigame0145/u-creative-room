/**
 * image-joiner.js
 * 最終修正版：SEO・シェアボタン・詳細説明対応
 */

// --- 2. 各ステップの詳細説明 ---
const toolExplanations = {
    step1_upload: {
        title: "画像のアップロード",
        body: "結合したい画像をフォルダから選択、またはこのエリアにドラッグ＆ドロップしてください。HEICは変換機能が読み込まれている場合、TIFFはブラウザが対応している場合に利用できます。"
    },
    step2_sort: {
        title: "並び替え・削除",
        body: "読み込まれた画像はサムネイルの矢印、またはドラッグで順序を入れ替えられます。不要な画像は「×」ボタンで即座に除外できます。"
    },
    step3_direction: {
        title: "結合の方向（縦・横）",
        body: "画像を「縦」に並べるか「横」に並べるかを選択します。SNS投稿用には縦、パノラマ写真のように並べるには横がおすすめです。"
    },
    step4_bgcolor: {
        title: "背景色・透過設定",
        body: "画像同士の隙間や、サイズ差によって生じる余白の色を設定します。透過設定を有効にすると背景を透明にできます。"
    },
    step5_sync: {
        title: "サイズの自動調整",
        body: "一番大きい画像や小さい画像に合わせて、他の画像サイズを自動で拡大・縮小し、ガタつきのないきれいな結合画像を作成します。"
    },
    step6_format: {
        title: "保存形式の選択",
        body: "JPG、PNG、WebPから用途に合わせて保存形式を選べます。画質優先ならPNG、軽量化ならJPEGが最適です。"
    },
    step6_filename: { title: '保存ファイル名', body: '保存する画像の名前を入力します。未入力ならcombined-imageという名前で保存します。' },
    step7_preview: {
        title: "プレビューと保存",
        body: "作成された画像を確認し、「名前をつけて保存する」でデバイスにダウンロードします。サーバーには保存されないため安全です。"
    }
};

// --- 3. アプリケーション機能 ---
let images = [];
let orientation = 'v'; // 'v' or 'h'

function initExplanations() {
    document.querySelectorAll('[data-explain-id]').forEach(el => {
        const id = el.getAttribute('data-explain-id');
        const box = el.parentElement.querySelector('.tooltip-box');
        if (box && toolExplanations[id]) {
            box.innerText = toolExplanations[id].body;
            el.parentElement.addEventListener('mouseenter', () => {
                const rect = el.getBoundingClientRect();
                box.style.top = 'auto';
                if (rect.top < 180) {
                    box.classList.remove('tooltip-up');
                    box.classList.add('tooltip-down');
                } else {
                    box.classList.remove('tooltip-down');
                    box.classList.add('tooltip-up');
                }
            });
        }
    });

    document.querySelectorAll('[data-explain-block]').forEach(el => {
        const id = el.getAttribute('data-explain-block');
        const data = toolExplanations[id];
        if (data) {
            el.innerHTML = `<h3 class="font-bold text-blue-600 mb-2 flex items-center gap-2"><span class="w-1 h-4 bg-blue-600 rounded-full"></span>${data.title}</h3><p class="text-sm text-gray-600 leading-relaxed">${data.body.replace(/\n/g, '<br>')}</p>`;
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initExplanations();

    const imageInput = document.getElementById('imageInput');
    const dropZone = document.getElementById('dropZone');
    const dirVertical = document.getElementById('dirVertical');
    const dirHorizontal = document.getElementById('dirHorizontal');
    const generateBtn = document.getElementById('generateBtn');
    const downloadBtn = document.getElementById('downloadBtn');

    imageInput.onchange = async (e) => { await handleFiles(e.target.files); imageInput.value = ''; };
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); });
    ['bgColor', 'transparentBg', 'sizeBase'].forEach(id => document.getElementById(id).addEventListener('change', invalidatePreview));
    generateBtn.disabled = true;

    dirVertical.onclick = () => {
        orientation = 'v'; invalidatePreview();
        dirVertical.className = "flex-1 py-3 rounded-xl font-bold bg-blue-600 text-white shadow-md transition";
        dirHorizontal.className = "flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition";
    };

    dirHorizontal.onclick = () => {
        orientation = 'h'; invalidatePreview();
        dirHorizontal.className = "flex-1 py-3 rounded-xl font-bold bg-blue-600 text-white shadow-md transition";
        dirVertical.className = "flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition";
    };

    generateBtn.onclick = () => processImages();
    downloadBtn.onclick = downloadResult;

});

let loadingImages = false;
async function handleFiles(files) {
    if (loadingImages) return;
    loadingImages = true;
    const button = document.getElementById('generateBtn');
    button.disabled = true;
    try {
        for (const file of Array.from(files)) {
            try { await addImage(file, file.name); }
            catch (error) { ToolUtils.notify(file.name + ': ' + error.message); }
        }
        renderThumbnails(); invalidatePreview();
    } finally { loadingImages = false; button.disabled = images.length === 0; }
}
async function addImage(file, name) {
    const { image, url } = await ToolUtils.decodeImage(file);
    images.push({ img: image, name, url });
}
function invalidatePreview() {
    document.getElementById('previewSection').classList.add('hidden');
}
function renderThumbnails() {
    const container = document.getElementById('thumbContainer');
    document.getElementById('sortSection').classList.toggle('hidden', images.length === 0);
    document.getElementById('generateBtn').disabled = loadingImages || images.length === 0;
    container.innerHTML = '';
    images.forEach((data, index) => {
        const div = document.createElement('div'); div.className = 'relative flex-shrink-0'; div.draggable = true;
        const img = document.createElement('img'); img.src = data.img.src; img.alt = data.name; img.className = 'h-24 w-24 object-cover rounded-xl border border-gray-200';
        div.appendChild(img);
        const controls = document.createElement('div'); controls.className = 'flex justify-between gap-1 mt-2';
        [['←', -1, '前へ移動'], ['→', 1, '後ろへ移動'], ['×', 0, '削除']].forEach(([text, direction, label]) => {
            const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = text;
            btn.className = 'px-2 bg-gray-100 rounded-lg text-gray-700'; btn.setAttribute('aria-label', data.name + 'を' + label);
            btn.disabled = direction !== 0 && (index + direction < 0 || index + direction >= images.length);
            btn.onclick = () => direction === 0 ? removeImage(index) : moveImage(index, index + direction);
            controls.appendChild(btn);
        });
        div.appendChild(controls);
        div.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', String(index)));
        div.addEventListener('dragover', e => e.preventDefault());
        div.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); const from = Number(e.dataTransfer.getData('text/plain')); if (Number.isInteger(from) && from >= 0 && from < images.length) moveImage(from, index); });
        container.appendChild(div);
    });
}
function moveImage(from, to) {
    const [image] = images.splice(from, 1); images.splice(to, 0, image);
    renderThumbnails(); invalidatePreview();
}
function removeImage(index) {
    URL.revokeObjectURL(images[index].url); images.splice(index, 1);
    renderThumbnails(); invalidatePreview();
}

async function processImages() {
    if (images.length < 1) return;
    const canvas = document.getElementById('resultCanvas');
    const ctx = canvas.getContext('2d');
    const sizeBase = document.getElementById('sizeBase').value;
    const isTransparent = document.getElementById('transparentBg').checked;
    const bgColor = document.getElementById('bgColor').value;

    let targetWidth = images[0].img.width;
    let targetHeight = images[0].img.height;

    if (sizeBase === 'max') {
        targetWidth = Math.max(...images.map(i => i.img.width));
        targetHeight = Math.max(...images.map(i => i.img.height));
    } else if (sizeBase === 'min') {
        targetWidth = Math.min(...images.map(i => i.img.width));
        targetHeight = Math.min(...images.map(i => i.img.height));
    }

    let totalW = 0, totalH = 0;
    if (orientation === 'v') {
        totalW = sizeBase === 'none' ? Math.max(...images.map(i => i.img.width)) : targetWidth;
        images.forEach(i => totalH += sizeBase === 'none' ? i.img.height : (targetWidth / i.img.width) * i.img.height);
    } else {
        totalH = sizeBase === 'none' ? Math.max(...images.map(i => i.img.height)) : targetHeight;
        images.forEach(i => totalW += sizeBase === 'none' ? i.img.width : (targetHeight / i.img.height) * i.img.width);
    }

    totalW = Math.ceil(totalW); totalH = Math.ceil(totalH);
    if (totalW > 32767 || totalH > 32767 || totalW * totalH > 64000000) {
        ToolUtils.notify('結合後の画像が大きすぎます。画像の枚数や解像度を減らしてください。'); return;
    }
    canvas.width = totalW;
    canvas.height = totalH;

    if (isTransparent) {
        ctx.clearRect(0, 0, totalW, totalH);
    } else {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, totalW, totalH);
    }

    let currentX = 0, currentY = 0;
    images.forEach(data => {
        let drawW, drawH;
        if (orientation === 'v') {
            drawW = sizeBase === 'none' ? data.img.width : targetWidth;
            drawH = sizeBase === 'none' ? data.img.height : (targetWidth / data.img.width) * data.img.height;
            ctx.drawImage(data.img, 0, currentY, drawW, drawH);
            currentY += drawH;
        } else {
            drawH = sizeBase === 'none' ? data.img.height : targetHeight;
            drawW = sizeBase === 'none' ? data.img.width : (targetHeight / data.img.height) * data.img.width;
            ctx.drawImage(data.img, currentX, 0, drawW, drawH);
            currentX += drawW;
        }
    });

    document.getElementById('previewSection').classList.remove('hidden');
    document.getElementById('actionArea').classList.remove('hidden');
    window.scrollTo({ top: document.getElementById('previewSection').offsetTop, behavior: 'smooth' });
}

function downloadResult() {
    const canvas = document.getElementById('resultCanvas');
    const format = document.getElementById('saveFormat').value;
    const fileName = document.getElementById('fileNameInput').value || 'combined-image';
    const link = document.createElement('a');
    link.download = `${fileName}.${format.split('/')[1]}`;
    let output = canvas;
    if (format === 'image/jpeg') {
        output = document.createElement('canvas'); output.width = canvas.width; output.height = canvas.height;
        const ctx = output.getContext('2d'); ctx.fillStyle = document.getElementById('bgColor').value;
        ctx.fillRect(0, 0, output.width, output.height); ctx.drawImage(canvas, 0, 0);
    }
    link.href = output.toDataURL(format);
    link.click();
}

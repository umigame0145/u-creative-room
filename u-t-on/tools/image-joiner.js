/**
 * image-joiner.js
 * 最終修正版：SEO・シェアボタン・詳細説明対応
 */

// --- 2. 各ステップの詳細説明 ---
const toolExplanations = {
    step1_upload: {
        title: "画像のアップロード",
        body: "結合したい画像をフォルダから選択、またはこのエリアにドラッグ＆ドロップしてください。iPhoneのHEIC形式やTIFF形式にも対応しています。"
    },
    step2_sort: {
        title: "並び替え・削除",
        body: "読み込まれた画像はサムネイルを左右にドラッグして順序を入れ替えられます。不要な画像は「×」ボタンで即座に除外できます。"
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

    imageInput.onchange = (e) => handleFiles(e.target.files);
    
    dirVertical.onclick = () => {
        orientation = 'v';
        dirVertical.className = "flex-1 py-3 rounded-xl font-bold bg-blue-600 text-white shadow-md transition";
        dirHorizontal.className = "flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition";
    };

    dirHorizontal.onclick = () => {
        orientation = 'h';
        dirHorizontal.className = "flex-1 py-3 rounded-xl font-bold bg-blue-600 text-white shadow-md transition";
        dirVertical.className = "flex-1 py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition";
    };

    generateBtn.onclick = () => processImages();
    downloadBtn.onclick = downloadResult;
    
});

async function handleFiles(files) {
    for (let file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
            await addImage(converted, file.name);
        } else {
            await addImage(file, file.name);
        }
    }
    renderThumbnails();
}

async function addImage(file, name) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                images.push({ img, name });
                resolve();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function renderThumbnails() {
    const container = document.getElementById('thumbContainer');
    const section = document.getElementById('sortSection');
    container.innerHTML = '';
    
    if (images.length > 0) section.classList.remove('hidden');

    images.forEach((data, index) => {
        const div = document.createElement('div');
        div.className = "relative flex-shrink-0 group";
        div.innerHTML = `
            <img src="${data.img.src}" class="h-24 w-24 object-cover rounded-xl shadow-sm border border-gray-100">
            <button onclick="removeImage(${index})" class="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity">×</button>
        `;
        container.appendChild(div);
    });
}

function removeImage(index) {
    images.splice(index, 1);
    renderThumbnails();
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
        totalW = targetWidth;
        images.forEach(i => totalH += (targetWidth / i.img.width) * i.img.height);
    } else {
        totalH = targetHeight;
        images.forEach(i => totalW += (targetHeight / i.img.height) * i.img.width);
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
            drawW = targetWidth;
            drawH = (targetWidth / data.img.width) * data.img.height;
            ctx.drawImage(data.img, currentY, currentY, drawW, drawH); // 修正：Y軸方向へ描画
            currentY += drawH;
        } else {
            drawH = targetHeight;
            drawW = (targetHeight / data.img.height) * data.img.width;
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
    link.href = canvas.toDataURL(format);
    link.click();
}
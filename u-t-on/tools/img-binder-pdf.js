/**
 * img-binder-pdf.js
 * 画像梱包（PDF）ツール ロジック
 * SEO外部管理・省略なし完全版
 */

// --- 1. SEO・メタタグ設定（seo-config.jsから取得） ---
const currentToolId = "img-binder-pdf";
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

// --- 2. 各ステップの詳細説明（ここで直接編集してください） ---
const toolExplanations = {
    step1_upload: {
        title: "画像の選択",
        body: "「ファイルを選択」で複数の画像を個別に選ぶか、「フォルダを選択」でフォルダ内の画像をまとめて読み込めます。\n\nフォルダを選択した場合は、そのフォルダ名が自動的に保存ファイル名の初期値になります。"
    },
    step2_sort: {
        title: "並び替え・管理",
        body: "読み込まれた画像の一覧です。左側の「☰」をドラッグして順序を入れ替えられます。\n\nまた、移動したい画像を選んでから移動先のページ番号を入力して「移動」ボタンを押すと、指定位置へ飛ばすことができます。"
    },
    step3_pagesize: {
        title: "用紙サイズ",
        body: "「1ページ1枚」は元の画像サイズを維持してPDF化します。A4やB5を選ぶと、各画像が指定した用紙サイズに収まるように自動調整（拡大・縮小）されます。"
    },
    step4_margin: {
        title: "ページ余白",
        body: "画像と用紙の端の間に作る余白をミリ単位(mm)で設定します。0にすると用紙の端まで画像が表示されます。マイナス値が入力された場合は自動的に0になります。"
    },
    step5_align: {
        title: "貼り付け位置",
        body: "A4やB5などの用紙サイズを指定した際に、画像を用紙のどこに配置するかを9方向から選択できます。元の画像サイズ維持モードでは使用できません。"
    },
    step6_filename: {
        title: "保存ファイル名",
        body: "PDFを保存する際のファイル名です。何も入力しない場合は「u-packed-images」という名前で保存されます。"
    }
};

// --- 3. アプリケーション機能ロジック ---

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
            el.innerHTML = `
                <h3 class="font-bold text-blue-600 mb-2 flex items-center gap-2">
                    <span class="w-1 h-4 bg-blue-600 rounded-full"></span>${data.title}
                </h3>
                <p class="text-sm text-gray-600 leading-relaxed">${data.body.replace(/\n/g, '<br>')}</p>
            `;
        }
    });
}

const state = {
    images: [],
    history: [],
    selectedIndex: null,
    draggedIndex: null,
    align: 'mc'
};

function updateAlignSettingsState() {
    const pageSize = document.getElementById('pageSize');
    const alignArea = document.getElementById('alignSettings');
    const alignGridBtns = document.querySelectorAll('.align-grid-btn');
    if (!pageSize || !alignArea) return;
    const isDisabled = (pageSize.value === 'original');
    if (!isDisabled) {
        alignArea.classList.remove('opacity-50', 'pointer-events-none');
    } else {
        alignArea.classList.add('opacity-50', 'pointer-events-none');
    }
    alignGridBtns.forEach(btn => {
        btn.disabled = isDisabled;
        if (isDisabled) btn.classList.add('cursor-not-allowed');
        else btn.classList.remove('cursor-not-allowed');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initExplanations(); 
    const imageInput = document.getElementById('imageInput');
    const folderInput = document.getElementById('folderInput');
    const addMoreInput = document.getElementById('addMoreInput');
    const generateBtn = document.getElementById('generatePdfBtn');
    const pageSize = document.getElementById('pageSize');
    const alignGridBtns = document.querySelectorAll('.align-grid-btn');

    updateAlignSettingsState();

    imageInput?.addEventListener('change', (e) => handleFiles(e.target.files));
    folderInput?.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            const folderName = files[0].webkitRelativePath.split('/')[0];
            const nameInput = document.getElementById('pdfFileName');
            if (nameInput) nameInput.value = folderName;
        }
        handleFiles(files);
    });
    addMoreInput?.addEventListener('change', (e) => handleFiles(e.target.files, true));
    
    generateBtn?.addEventListener('click', generatePDF);
    pageSize?.addEventListener('change', updateAlignSettingsState);

    alignGridBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            alignGridBtns.forEach(b => b.classList.remove('active', 'bg-blue-600', 'text-white'));
            btn.classList.add('active', 'bg-blue-600', 'text-white');
            state.align = btn.dataset.align;
        });
    });

    document.getElementById('movePageBtn')?.addEventListener('click', moveToIndex);
    document.getElementById('moveUpBtn')?.addEventListener('click', () => stepMove(-1));
    document.getElementById('moveDownBtn')?.addEventListener('click', () => stepMove(1));
    document.getElementById('deleteItemBtn')?.addEventListener('click', deleteSelected);
    document.getElementById('undoBtn')?.addEventListener('click', undoAction);
});

async function handleFiles(fileList, isAppend = false) {
    const files = Array.from(fileList);
    const supportedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'tiff', 'tif'];
    const targetFiles = files.filter(f => supportedExts.includes(f.name.split('.').pop().toLowerCase()));
    if (targetFiles.length === 0) return;
    if (state.images.length > 0) saveHistory();
    if (!isAppend) state.images = [];
    toggleProgress(true, `画像を読み込み中... (0/${targetFiles.length})`);
    for (let i = 0; i < targetFiles.length; i++) {
        updateStatus(`解析中... (${i + 1}/${targetFiles.length})`);
        try {
            const data = await processImageMinimal(targetFiles[i]);
            state.images.push(data);
        } catch (err) { console.error(err); }
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }
    renderList();
    toggleProgress(false);
    if (imageInput) imageInput.value = '';
    if (folderInput) folderInput.value = '';
}

async function processImageMinimal(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = Math.min(120 / img.width, 120 / img.height, 1);
                canvas.width = img.width * scale; canvas.height = img.height * scale;
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve({ name: file.name, thumb: canvas.toDataURL('image/jpeg', 0.4), file: file, w: img.width, h: img.height });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function renderList() {
    const sortSection = document.getElementById('sortSection');
    const container = document.getElementById('imageList');
    if (state.images.length === 0) {
        if (sortSection) sortSection.classList.add('hidden');
        if (container) container.innerHTML = '';
        state.selectedIndex = null;
        return;
    }
    if (sortSection) sortSection.classList.remove('hidden');
    if (container) container.innerHTML = '';
    state.images.forEach((img, idx) => {
        const li = document.createElement('li');
        li.draggable = true;
        li.className = `flex items-center p-3 border-b cursor-pointer select-none ${state.selectedIndex === idx ? 'bg-blue-100 ring-2 ring-blue-400 z-10' : 'bg-white hover:bg-gray-50'}`;
        li.addEventListener('dragstart', () => { state.draggedIndex = idx; li.classList.add('dragging'); });
        li.addEventListener('dragover', (e) => e.preventDefault());
        li.addEventListener('drop', () => {
            if (state.draggedIndex === null || state.draggedIndex === idx) return;
            saveHistory();
            const [movedItem] = state.images.splice(state.draggedIndex, 1);
            state.images.splice(idx, 0, movedItem);
            state.selectedIndex = idx; renderList();
        });
        li.onclick = () => { state.selectedIndex = idx; renderList(); };
        li.innerHTML = `<div class="flex items-center gap-4 w-full pointer-events-none"><div class="text-gray-400">☰</div><div class="w-6 text-xs font-bold text-gray-400 font-mono">${idx+1}</div><img src="${img.thumb}" class="w-12 h-12 object-cover rounded shadow-sm bg-gray-100"><div class="flex-1 truncate text-sm font-bold text-gray-700">${img.name}</div></div>`;
        container?.appendChild(li);
    });
}

async function generatePDF() {
    if (state.images.length === 0) return;
    const { jsPDF } = window.jspdf;
    let margin = Math.max(0, parseFloat(document.getElementById('marginSize')?.value || 0));
    const pageSizeSetting = document.getElementById('pageSize')?.value || 'original';
    const fileNameInput = document.getElementById('pdfFileName')?.value || 'u-packed-images';
    toggleProgress(true, `PDFを作成中... (0/${state.images.length})`);
    const doc = new jsPDF({ orientation: 'p', unit: 'mm' });
    for (let i = 0; i < state.images.length; i++) {
        updateStatus(`作成中... (${i + 1}/${state.images.length})`);
        const imgData = state.images[i];
        const fullImg = await new Promise((resolve) => {
            const r = new FileReader();
            r.onload = (e) => { const img = new Image(); img.onload = () => resolve(img); img.src = e.target.result; };
            r.readAsDataURL(imgData.file);
        });
        let pw, ph;
        if (pageSizeSetting === 'original') {
            pw = imgData.w * 0.264583; ph = imgData.h * 0.264583;
            if (i > 0) doc.addPage([pw, ph], pw > ph ? 'l' : 'p');
            else { doc.deletePage(1); doc.addPage([pw, ph], pw > ph ? 'l' : 'p'); }
        } else {
            if (i > 0) doc.addPage(pageSizeSetting);
            pw = doc.internal.pageSize.getWidth(); ph = doc.internal.pageSize.getHeight();
        }
        const pW = pw - (margin * 2); const pH = ph - (margin * 2);
        const s = Math.min(pW / imgData.w, pH / imgData.h);
        const dW = imgData.w * s; const dH = imgData.h * s;
        let x = margin + (pW - dW) / 2; let y = margin + (pH - dH) / 2;
        if (state.align.includes('l')) x = margin;
        if (state.align.includes('r')) x = margin + (pW - dW);
        if (state.align.startsWith('t')) y = margin;
        if (state.align.startsWith('b')) y = margin + (pH - dH);
        doc.addImage(fullImg, 'JPEG', x, y, dW, dH);
        fullImg.src = ""; await new Promise(r => setTimeout(r, 10));
    }
    doc.save(`${fileNameInput}.pdf`);
    toggleProgress(false);
}

function saveHistory() { state.history.push(JSON.stringify(state.images)); if (state.history.length > 20) state.history.shift(); }
function undoAction() { if (state.history.length === 0) return; state.images = JSON.parse(state.history.pop()); state.selectedIndex = null; renderList(); }
function moveToIndex() {
    if (state.selectedIndex === null) return;
    const target = parseInt(document.getElementById('targetPage')?.value || 0) - 1;
    if (isNaN(target) || target < 0 || target >= state.images.length) return;
    saveHistory();
    const [item] = state.images.splice(state.selectedIndex, 1);
    state.images.splice(target, 0, item);
    state.selectedIndex = target; renderList();
}
function stepMove(dir) {
    if (state.selectedIndex === null) return;
    const newIdx = state.selectedIndex + dir;
    if (newIdx < 0 || newIdx >= state.images.length) return;
    saveHistory();
    [state.images[state.selectedIndex], state.images[newIdx]] = [state.images[newIdx], state.images[state.selectedIndex]];
    state.selectedIndex = newIdx; renderList();
}
function deleteSelected() {
    if (state.selectedIndex === null || !confirm("この画像をリストから削除しますか？")) return;
    saveHistory();
    state.images.splice(state.selectedIndex, 1);
    state.selectedIndex = null; renderList();
}
function toggleProgress(show, status = "") {
    const el = document.getElementById('progressArea'); const txt = document.getElementById('progressStatus');
    if (show) { el?.classList.remove('hidden'); if (txt) txt.innerText = status; }
    else { el?.classList.add('hidden'); }
}
function updateStatus(status) { const txt = document.getElementById('progressStatus'); if (txt) txt.innerText = status; }
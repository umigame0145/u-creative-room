/**
 * img-binder-pdf.js
 * 画像梱包（PDF）ツール ロジック
 * SEO外部管理・省略なし完全版
 */

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

let imageBatchBusy = false;
async function handleFiles(fileList, isAppend = false) {
    if (imageBatchBusy) return;
    imageBatchBusy = true;
    const files = Array.from(fileList);
    const loaded = [];
    toggleProgress(true, '画像を読み込み中...');
    try {
        for (let i = 0; i < files.length; i++) {
            updateStatus('画像を読み込み中... (' + (i + 1) + '/' + files.length + ')');
            try { loaded.push(await processImageMinimal(files[i])); }
            catch (error) { ToolUtils.notify(files[i].name + ': ' + error.message); }
        }
        if (loaded.length) {
            saveHistory();
            state.images = isAppend ? state.images.concat(loaded) : loaded;
            state.selectedIndex = null; renderList();
        }
    } finally {
        imageBatchBusy = false; toggleProgress(false);
        ['imageInput', 'folderInput', 'addMoreInput'].forEach(id => { const input = document.getElementById(id); if (input) input.value = ''; });
    }
}
async function processImageMinimal(file) {
    const { image: img, file: source, url } = await ToolUtils.decodeImage(file);
    try {
        const canvas = document.createElement('canvas');
        const scale = Math.min(120 / img.width, 120 / img.height, 1);
        canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        return { name: file.name, thumb: canvas.toDataURL('image/jpeg', 0.4), file: source, w: img.width, h: img.height };
    } finally { URL.revokeObjectURL(url); }
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
        li.innerHTML = `<div class="flex items-center gap-4 w-full pointer-events-none"><div class="text-gray-400">☰</div><div class="w-6 text-xs font-bold text-gray-400 font-mono">${idx+1}</div><img src="${img.thumb}" class="w-12 h-12 object-cover rounded shadow-sm bg-gray-100"><div class="flex-1 truncate text-sm font-bold text-gray-700">${ToolUtils.escapeHTML(img.name)}</div></div>`;
        container?.appendChild(li);
    });
}

async function generatePDF() {
    if (imageBatchBusy || state.images.length === 0) return;
    if (!window.jspdf?.jsPDF) { ToolUtils.notify('PDF作成機能を読み込めません。接続を確認してページを再読み込みしてください。'); return; }
    const margin = Math.max(0, Number(document.getElementById('marginSize')?.value) || 0);
    const pageSize = document.getElementById('pageSize')?.value || 'original';
    const fileName = (document.getElementById('pdfFileName')?.value.trim() || 'u-packed-images').replace(/\.pdf$/i, '');
    imageBatchBusy = true;
    const button = document.getElementById('generatePdfBtn'); button.disabled = true;
    toggleProgress(true, 'PDFを作成中...');
    try {
        const first = state.images[0];
        const original = pageSize === 'original';
        const paperFormat = pageSize === 'b5' ? [182, 257] : pageSize;
        const initialFormat = original ? [first.w * 0.264583, first.h * 0.264583] : paperFormat;
        const doc = new window.jspdf.jsPDF({ orientation: original && first.w > first.h ? 'l' : 'p', unit: 'mm', format: initialFormat });
        for (let i = 0; i < state.images.length; i++) {
            const data = state.images[i];
            const format = original ? [data.w * 0.264583, data.h * 0.264583] : paperFormat;
            if (i > 0) doc.addPage(format, original && data.w > data.h ? 'l' : 'p');
            const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
            if (margin * 2 >= Math.min(pw, ph)) throw new Error('余白が大きすぎます。用紙の短辺の半分未満に設定してください。');
            const availableW = pw - margin * 2, availableH = ph - margin * 2;
            const scale = Math.min(availableW / data.w, availableH / data.h);
            const dw = data.w * scale, dh = data.h * scale;
            let x = margin + (availableW - dw) / 2, y = margin + (availableH - dh) / 2;
            if (!original) {
                if (state.align.includes('l')) x = margin;
                if (state.align.includes('r')) x = margin + availableW - dw;
                if (state.align.startsWith('t')) y = margin;
                if (state.align.startsWith('b')) y = margin + availableH - dh;
            }
            const { image, url } = await ToolUtils.decodeImage(data.file);
            try {
                const canvas = document.createElement('canvas'); canvas.width = data.w; canvas.height = data.h;
                const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0);
                doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', x, y, dw, dh);
            } finally { URL.revokeObjectURL(url); }
            updateStatus('PDFを作成中... (' + (i + 1) + '/' + state.images.length + ')');
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        doc.save(fileName + '.pdf');
    } catch (error) { ToolUtils.notify(error.message || 'PDFを作成できませんでした。画像の枚数やサイズを減らしてください。'); }
    finally { imageBatchBusy = false; button.disabled = false; toggleProgress(false); }
}
function saveHistory() { state.history.push(state.images.slice()); if (state.history.length > 20) state.history.shift(); }
function undoAction() { if (imageBatchBusy || state.history.length === 0) return; state.images = state.history.pop(); state.selectedIndex = null; renderList(); }
function moveToIndex() {
    if (imageBatchBusy) return;
    if (state.selectedIndex === null) return;
    const target = parseInt(document.getElementById('targetPage')?.value || 0) - 1;
    if (isNaN(target) || target < 0 || target >= state.images.length) return;
    saveHistory();
    const [item] = state.images.splice(state.selectedIndex, 1);
    state.images.splice(target, 0, item);
    state.selectedIndex = target; renderList();
}
function stepMove(dir) {
    if (imageBatchBusy) return;
    if (state.selectedIndex === null) return;
    const newIdx = state.selectedIndex + dir;
    if (newIdx < 0 || newIdx >= state.images.length) return;
    saveHistory();
    [state.images[state.selectedIndex], state.images[newIdx]] = [state.images[newIdx], state.images[state.selectedIndex]];
    state.selectedIndex = newIdx; renderList();
}
function deleteSelected() {
    if (imageBatchBusy) return;
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

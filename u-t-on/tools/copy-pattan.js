/**
 * copy-pattan.js - 絵文字対応 & iOS/Chrome 安定版
 */

let history = []; 
let stockItems = []; 

document.addEventListener('DOMContentLoaded', () => {
    const mainArea = document.getElementById('mainTextArea');
    const container = document.getElementById('materialInputContainer');
    const addNewRowBtn = document.getElementById('addNewRowBtn');
    
    const copyBtn = document.getElementById('copyBtn');
    const undoBtn = document.getElementById('undoBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const saveStockBtn = document.getElementById('saveStockBtn');
    const stockList = document.getElementById('stockList');

    // --- 💾 データの保存・読み込み ---

    function saveAllToLocal() {
        try {
            const materialInputs = Array.from(document.querySelectorAll('.material-input')).map(input => input.value);
            const data = {
                mainText: mainArea.value,
                materials: materialInputs,
                stocks: stockItems
            };
            localStorage.setItem('copyPattanData', JSON.stringify(data));
        } catch (e) {
            console.error("Save failed:", e);
        }
    }

    function loadFromLocal() {
        try {
            const savedData = localStorage.getItem('copyPattanData');
            if (!savedData) return;
            const data = JSON.parse(savedData);
            mainArea.value = data.mainText || '';
            if (data.materials && data.materials.length > 0) {
                container.innerHTML = ''; 
                data.materials.forEach(text => createNewRow(text));
            }
            stockItems = data.stocks || [];
            renderStockList();
            updateUndoButton();
        } catch (e) {
            console.error("Load failed:", e);
        }
    }

    // --- 🧩 素材行の生成ロジック ---

    function createNewRow(initialValue = '') {
        const newRow = document.createElement('div');
        newRow.className = "flex gap-2 material-row";
        newRow.innerHTML = `
            <input type="text" class="flex-1 p-3 bg-gray-50 border-0 rounded-xl font-bold outline-none material-input text-sm" placeholder="素材を入力" value="${initialValue}">
            <button class="px-5 py-3 bg-gray-800 text-white rounded-xl font-bold add-to-main-btn text-xs">追加</button>
            <button class="px-4 py-3 bg-red-50 text-red-400 rounded-xl font-bold delete-row-btn">🗑️</button>
        `;
        container.appendChild(newRow);
        
        // 絵文字を破壊しないための追加処理
        newRow.querySelector('.add-to-main-btn').addEventListener('click', () => {
            const val = newRow.querySelector('.material-input').value;
            if(!val) return;
            
            saveState();
            // .value を直接書き換えることで絵文字（サロゲートペア）を保持
            mainArea.value = mainArea.value + val;
            
            updateUndoButton();
            saveAllToLocal();
        });

        newRow.querySelector('.delete-row-btn').addEventListener('click', () => {
            newRow.remove();
            saveAllToLocal();
        });

        newRow.querySelector('.material-input').addEventListener('input', () => saveAllToLocal());
    }

    addNewRowBtn.addEventListener('click', () => {
        createNewRow();
        saveAllToLocal();
    });

    // --- 📦 保存済みリスト描画 ---

    function renderStockList() {
        stockList.innerHTML = '';
        if (stockItems.length === 0) {
            stockList.innerHTML = '<p class="text-center py-8 text-gray-300 text-xs italic">保存されたデータはありません</p>';
            return;
        }

        stockItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = "p-4 bg-gray-50 rounded-2xl shadow-sm border border-gray-100 space-y-3";
            div.innerHTML = `
                <div class="text-sm font-medium text-gray-700 whitespace-pre-wrap break-all leading-relaxed">${item}</div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
                    <button class="btn-append py-2 bg-blue-600 text-white rounded-lg text-xs font-bold" data-index="${index}">追加</button>
                    <button class="btn-copy py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600" data-index="${index}">コピー</button>
                    <button class="btn-edit py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600" data-index="${index}">編集</button>
                    <button class="btn-delete py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-red-400" data-index="${index}">削除</button>
                </div>
            `;
            stockList.appendChild(div);
        });

        setupListActions();
    }

    function setupListActions() {
        document.querySelectorAll('.btn-append').forEach(btn => {
            btn.onclick = () => {
                saveState();
                mainArea.value = mainArea.value + stockItems[btn.dataset.index];
                updateUndoButton();
                saveAllToLocal();
            };
        });

        document.querySelectorAll('.btn-copy').forEach(btn => {
            btn.onclick = async () => {
                const text = stockItems[btn.dataset.index];
                try {
                    await navigator.clipboard.writeText(text);
                    alert("コピーしました！");
                } catch (err) {
                    const el = document.createElement('textarea');
                    el.value = text;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    alert("コピーしました");
                }
            };
        });

        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.onclick = () => {
                if (mainArea.value && !confirm("上書きしますか？")) return;
                saveState();
                mainArea.value = stockItems[btn.dataset.index];
                saveAllToLocal();
                window.scrollTo({ top: mainArea.offsetTop - 100, behavior: 'smooth' });
            };
        });

        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.onclick = () => {
                if(confirm("削除しますか？")) {
                    stockItems.splice(btn.dataset.index, 1);
                    renderStockList();
                    saveAllToLocal();
                }
            };
        });
    }

    // --- ⌨️ 作成エリア・コントロール ---

    function saveState() {
        history.push(mainArea.value);
        updateUndoButton();
    }

    function updateUndoButton() {
        undoBtn.disabled = (history.length === 0);
    }

    clearAllBtn.addEventListener('click', () => {
        if(mainArea.value && confirm("全て消去しますか？")) {
            saveState();
            mainArea.value = '';
            updateUndoButton();
            saveAllToLocal();
        }
    });

    saveStockBtn.addEventListener('click', () => {
        if (!mainArea.value) return;
        stockItems.push(mainArea.value);
        renderStockList();
        saveAllToLocal();
    });

    undoBtn.addEventListener('click', () => {
        if (history.length > 0) {
            mainArea.value = history.pop();
            updateUndoButton();
            saveAllToLocal();
        }
    });

    mainArea.addEventListener('input', () => {
        if (history.length > 0) { history = []; updateUndoButton(); }
        saveAllToLocal();
    });

    copyBtn.addEventListener('click', async () => {
        if (!mainArea.value) return;
        try {
            await navigator.clipboard.writeText(mainArea.value);
            const original = copyBtn.innerText;
            copyBtn.innerText = "✅ コピー完了！";
            setTimeout(() => copyBtn.innerText = original, 2000);
        } catch (e) {
            alert("コピーに失敗しました。手動で選択してコピーしてください。");
        }
    });

    // --- 📂 CSV連携 ---

    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.onclick = () => {
            const mainText = mainArea.value.replace(/"/g, '""');
            const materials = Array.from(document.querySelectorAll('.material-input'))
                                   .map(input => `"${input.value.replace(/"/g, '""')}"`)
                                   .join(',');
            let csvContent = `"${mainText}"\n${materials}\n`;     
            stockItems.forEach(item => {
                csvContent += `"${item.replace(/"/g, '""')}"\n`;
            });
            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `copy_pattan_backup.csv`;
            link.click();
        };
    }

    const csvFileInput = document.getElementById('csvFileInput');
    if (csvFileInput) {
        csvFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (re) => {
                const rows = parseCSV(re.target.result);
                if (rows.length < 1) return;
                if (confirm("データを上書きしますか？")) {
                    mainArea.value = rows[0][0] || '';
                    if (rows[1]) {
                        container.innerHTML = '';
                        rows[1].forEach(text => createNewRow(text));
                    }
                    stockItems = rows.slice(2).map(r => r[0]).filter(t => t !== undefined);
                    renderStockList();
                    saveAllToLocal();
                }
                e.target.value = '';
            };
            reader.readAsText(file);
        };
    }

    function parseCSV(text) {
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i+1];
            if (inQuotes) {
                if (char === '"' && nextChar === '"') { currentField += '"'; i++; }
                else if (char === '"') { inQuotes = false; }
                else { currentField += char; }
            } else {
                if (char === '"') { inQuotes = true; }
                else if (char === ',') { currentRow.push(currentField); currentField = ''; }
                else if (char === '\n' || char === '\r') {
                    if (char === '\r' && nextChar === '\n') i++;
                    currentRow.push(currentField); rows.push(currentRow);
                    currentRow = []; currentField = '';
                } else { currentField += char; }
            }
        }
        if (currentField || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow); }
        return rows;
    }

    // --- 🚀 初期化 ---
    loadFromLocal();
    if (container.children.length === 0) createNewRow();
});
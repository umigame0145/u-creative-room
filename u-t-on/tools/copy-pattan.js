/**
 * copy-pattan.js
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

    // --- 📂 CSV インポート・エクスポート機能 ---

    // CSVとして保存（書き出し）
    window.exportToCSV = () => {
        const mainText = mainArea.value.replace(/"/g, '""'); // ダブルクォートをエスケープ
        const materials = Array.from(document.querySelectorAll('.material-input'))
                               .map(input => `"${input.value.replace(/"/g, '""')}"`)
                               .join(',');
        
        let csvContent = `"${mainText}"\n`; // 1行目：メインテキスト
        csvContent += `${materials}\n`;     // 2行目：素材リスト
        
        stockItems.forEach(item => {
            csvContent += `"${item.replace(/"/g, '""')}"\n`; // 3行目以降：ストック
        });

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `copy_pattan_backup_${new Date().getTime()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // CSVから読み込み
    window.importFromCSV = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const rows = parseCSV(content);

            if (rows.length < 1) return;

            if (confirm("現在のデータが上書きされます。よろしいですか？")) {
                // 1. メインテキスト復元
                mainArea.value = rows[0][0] || '';

                // 2. 素材行の復元
                if (rows[1]) {
                    container.innerHTML = '';
                    rows[1].forEach(text => createNewRow(text));
                }

                // 3. 保存済みリストの復元
                stockItems = rows.slice(2).map(row => row[0]).filter(text => text !== undefined);
                
                renderStockList();
                saveAllToLocal();
                alert("データの復元が完了しました！");
            }
            event.target.value = ''; // 選択をリセット
        };
        reader.readAsText(file);
    };

    // CSVパース補助（簡易版：クォート対応）
    function parseCSV(text) {
        const rows = [];
        let currentRow = [];
        let currentField = '';
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const nextChar = text[i+1];

            if (inQuotes) {
                if (char === '"' && nextChar === '"') {
                    currentField += '"'; i++;
                } else if (char === '"') {
                    inQuotes = false;
                } else {
                    currentField += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    currentRow.push(currentField);
                    currentField = '';
                } else if (char === '\n' || char === '\r') {
                    if (char === '\r' && nextChar === '\n') i++;
                    currentRow.push(currentField);
                    rows.push(currentRow);
                    currentRow = [];
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
        }
        if (currentField || currentRow.length > 0) {
            currentRow.push(currentField);
            rows.push(currentRow);
        }
        return rows;
    }

    // --- 💾 既存のLocalStorageロジック (省略せずに統合してください) ---
    function saveAllToLocal() {
        const materialInputs = Array.from(document.querySelectorAll('.material-input')).map(input => input.value);
        const data = { mainText: mainArea.value, materials: materialInputs, stocks: stockItems };
        localStorage.setItem('copyPattanData', JSON.stringify(data));
    }

    function loadFromLocal() {
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
    }

    // --- 🧩 素材行・UI操作 (createNewRowなど前回同様) ---
    function createNewRow(initialValue = '') {
        const newRow = document.createElement('div');
        newRow.className = "flex gap-2 material-row";
        newRow.innerHTML = `
            <input type="text" class="flex-1 p-3 bg-gray-50 border-0 rounded-xl font-bold outline-none material-input text-sm" placeholder="素材を入力" value="${initialValue}">
            <button class="px-5 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-black transition add-to-main-btn text-xs">追加</button>
            <button class="px-4 py-3 bg-red-50 text-red-400 rounded-xl font-bold hover:bg-red-100 transition delete-row-btn">🗑️</button>
        `;
        container.appendChild(newRow);
        setupRowEvents(newRow);
    }

    function setupRowEvents(row) {
        const input = row.querySelector('.material-input');
        const addBtn = row.querySelector('.add-to-main-btn');
        const deleteRowBtn = row.querySelector('.delete-row-btn');
        addBtn.onclick = () => {
            if (!input.value) return;
            saveState(); mainArea.value += input.value; updateUndoButton(); saveAllToLocal();
        };
        deleteRowBtn.onclick = () => { row.remove(); saveAllToLocal(); };
        input.oninput = () => saveAllToLocal();
    }

    addNewRowBtn.onclick = () => { createNewRow(); saveAllToLocal(); };

    // ... (renderStockList, copyStock, editStock, deleteStock, appendStock は前回のまま維持)

    loadFromLocal();
    if (container.children.length === 0) createNewRow();
});
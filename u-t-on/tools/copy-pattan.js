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

    // --- 💾 データの保存・読み込みロジック ---

    // 全データをLocalStorageに保存する
    function saveAllToLocal() {
        const materialInputs = Array.from(document.querySelectorAll('.material-input')).map(input => input.value);
        const data = {
            mainText: mainArea.value,
            materials: materialInputs,
            stocks: stockItems
        };
        localStorage.setItem('copyPattanData', JSON.stringify(data));
    }

    // 保存されたデータを復元する
    function loadFromLocal() {
        const savedData = localStorage.getItem('copyPattanData');
        if (!savedData) return;

        const data = JSON.parse(savedData);
        
        // 1. 作成エリアの復元
        mainArea.value = data.mainText || '';

        // 2. 素材行の復元
        if (data.materials && data.materials.length > 0) {
            container.innerHTML = ''; // 初期行を一旦消す
            data.materials.forEach(text => {
                createNewRow(text);
            });
        }

        // 3. 保存済みリストの復元
        stockItems = data.stocks || [];
        renderStockList();
        updateUndoButton();
    }

    // --- 🛠 共通ユーティリティ ---

    function saveState() {
        history.push(mainArea.value);
        updateUndoButton();
    }

    function updateUndoButton() {
        if (undoBtn) {
            undoBtn.disabled = (history.length === 0);
        }
    }

    // --- 🧩 素材行の生成ロジック ---

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
            const text = input.value; 
            if (!text) return;
            saveState();
            mainArea.value += text;
            updateUndoButton();
            saveAllToLocal(); // 変更があったら保存
        };

        deleteRowBtn.onclick = () => {
            row.remove();
            saveAllToLocal(); // 削除時も保存
        };

        input.oninput = () => saveAllToLocal(); // 入力内容の変化もリアルタイム保存
    }

    addNewRowBtn.onclick = () => {
        createNewRow();
        saveAllToLocal();
    };

    // --- 📦 保存済みリスト描画 ---

    function renderStockList() {
        if (stockItems.length === 0) {
            stockList.innerHTML = '<p class="text-center py-8 text-gray-300 text-xs italic">保存されたデータはありません</p>';
            return;
        }

        stockList.innerHTML = '';
        stockItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = "p-4 bg-gray-50 rounded-2xl shadow-sm border border-gray-100 space-y-3";
            div.innerHTML = `
                <div class="text-sm font-medium text-gray-700 whitespace-pre-wrap break-all leading-relaxed">${item}</div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
                    <button onclick="appendStock(${index})" class="py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold transition">追加</button>
                    <button onclick="copyStock(${index})" class="py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 text-xs font-bold transition text-gray-600">コピー</button>
                    <button onclick="editStock(${index})" class="py-2 bg-white border border-gray-200 rounded-lg hover:bg-yellow-50 text-xs font-bold transition text-gray-600">編集</button>
                    <button onclick="deleteStock(${index})" class="py-2 bg-white border border-gray-200 rounded-lg hover:bg-red-50 text-red-400 text-xs font-bold transition">削除</button>
                </div>
            `;
            stockList.appendChild(div);
        });
    }

    // --- 🖱 メインエリア・リスト操作 ---

    clearAllBtn.onclick = () => {
        if(mainArea.value && confirm("作成中の文字列を全て消去しますか？")) {
            saveState();
            mainArea.value = '';
            updateUndoButton();
            saveAllToLocal();
        }
    };

    saveStockBtn.onclick = () => {
        const text = mainArea.value;
        if (!text) return;
        stockItems.push(text);
        renderStockList();
        saveAllToLocal();
    };

    window.appendStock = (index) => {
        saveState();
        mainArea.value += stockItems[index];
        updateUndoButton();
        saveAllToLocal();
    };

    window.copyStock = async (index) => {
        const text = stockItems[index];
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            alert("テスト環境のためコピーできません。編集ボタンでエリアに戻してください。");
        }
    };

    window.editStock = (index) => {
        if (mainArea.value && !confirm("現在の内容を上書きしますか？")) return;
        saveState();
        mainArea.value = stockItems[index];
        history = [];
        updateUndoButton();
        saveAllToLocal();
        window.scrollTo({ top: mainArea.offsetTop - 100, behavior: 'smooth' });
    };

    window.deleteStock = (index) => {
        if(confirm("このストックを削除しますか？")) {
            stockItems.splice(index, 1);
            renderStockList();
            saveAllToLocal();
        }
    };

    undoBtn.onclick = () => {
        if (history.length > 0) {
            mainArea.value = history.pop();
            updateUndoButton();
            saveAllToLocal();
        }
    };

    mainArea.addEventListener('input', () => {
        if (history.length > 0) {
            history = [];
            updateUndoButton();
        }
        saveAllToLocal(); // リアルタイム保存
    });

    copyBtn.onclick = async () => {
        if (!mainArea.value) return;
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(mainArea.value);
            const original = copyBtn.innerText;
            copyBtn.innerText = "✅ コピー完了！";
            setTimeout(() => copyBtn.innerText = original, 2000);
        }
    };

    // --- 🚀 初期化実行 ---
    loadFromLocal();
    // もしデータが何もなければ、空の1行目を作る
    if (container.children.length === 0) {
        createNewRow();
    }
});
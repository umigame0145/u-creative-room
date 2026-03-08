/**
 * copy-pattan.js
 */

let history = []; 
let stockItems = []; // 保存済み文字列の配列

document.addEventListener('DOMContentLoaded', () => {
    const mainArea = document.getElementById('mainTextArea');
    const materialInput = document.getElementById('materialInput');
    const addMaterialBtn = document.getElementById('addMaterialBtn');
    const materialList = document.getElementById('materialList');
    const copyBtn = document.getElementById('copyBtn');
    const undoBtn = document.getElementById('undoBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const saveStockBtn = document.getElementById('saveStockBtn');
    const stockList = document.getElementById('stockList');

    // --- メインエリア操作 ---
    
    // 全クリア
    clearAllBtn.onclick = () => {
        if(mainArea.value && confirm("作成中の文字列を全て消去しますか？")) {
            saveState();
            mainArea.value = '';
            updateUndoButton();
        }
    };

    // 保存ボタン（ストックへ追加）
    saveStockBtn.onclick = () => {
        const text = mainArea.value.trim();
        if (!text) return;
        stockItems.push(text);
        renderStockList();
        // オプション：保存したらクリアするかどうかはお好みで
    };

    // --- 素材エリア操作 ---

    addMaterialBtn.onclick = () => {
        const text = materialInput.value.trim();
        if (!text) return;

        const btn = document.createElement('button');
        btn.className = "px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-sm font-bold hover:bg-blue-600 hover:text-white transition shadow-sm border border-blue-100";
        btn.innerText = text;
        btn.onclick = () => {
            saveState();
            mainArea.value += text;
            updateUndoButton();
        };
        materialList.appendChild(btn);
        materialInput.value = '';
    };

    // --- 保存済みリスト描画 ---

    function renderStockList() {
        stockList.innerHTML = '';
        stockItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-3 bg-gray-50 rounded-xl gap-2";
            div.innerHTML = `
                <div class="flex-1 truncate text-sm font-medium text-gray-700">${item}</div>
                <div class="flex gap-1 shrink-0">
                    <button onclick="copyStock(${index})" class="p-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 text-xs font-bold transition">コピー</button>
                    <button onclick="editStock(${index})" class="p-2 bg-white border border-gray-200 rounded-lg hover:bg-yellow-50 text-xs font-bold transition">編集</button>
                    <button onclick="deleteStock(${index})" class="p-2 bg-white border border-gray-200 rounded-lg hover:bg-red-50 text-red-400 text-xs font-bold transition">削除</button>
                </div>
            `;
            stockList.appendChild(div);
        });
    }

    // --- 各種アクション関数（グローバルに公開） ---

    window.copyStock = async (index) => {
        const text = stockItems[index];
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            alert("ストックをコピーしました");
        } else {
            alert("テスト環境のためコピーできません。編集ボタンでエリアに戻してからコピーしてください。");
        }
    };

    window.editStock = (index) => {
        saveState();
        mainArea.value = stockItems[index];
        updateUndoButton();
        window.scrollTo({ top: mainArea.offsetTop - 100, behavior: 'smooth' });
    };

    window.deleteStock = (index) => {
        if(confirm("このストックを削除しますか？")) {
            stockItems.splice(index, 1);
            renderStockList();
        }
    };

    // --- ユーティリティ ---

    function saveState() {
        history.push(mainArea.value);
        updateUndoButton();
    }

    function updateUndoButton() {
        undoBtn.disabled = (history.length === 0);
    }

    undoBtn.onclick = () => {
        if (history.length > 0) {
            mainArea.value = history.pop();
            updateUndoButton();
        }
    };

    mainArea.addEventListener('input', () => {
        if (history.length > 0) {
            history = [];
            updateUndoButton();
        }
    });

    // コピーボタン（メイン）
    copyBtn.onclick = async () => {
        if (!mainArea.value) return;
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(mainArea.value);
            const original = copyBtn.innerText;
            copyBtn.innerText = "✅ コピー完了！";
            setTimeout(() => copyBtn.innerText = original, 2000);
        } else {
            alert("コピーに失敗しました");
        }
    };
});
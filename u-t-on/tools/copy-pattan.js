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

    // --- ユーティリティ関数 ---

    function saveState() {
        history.push(mainArea.value);
        updateUndoButton();
    }

    function updateUndoButton() {
        if (undoBtn) {
            undoBtn.disabled = (history.length === 0);
        }
    }

    // --- メインエリア操作 ---
    
    clearAllBtn.onclick = () => {
        if(mainArea.value && confirm("作成中の文字列を全て消去しますか？")) {
            saveState();
            mainArea.value = '';
            updateUndoButton();
        }
    };

    saveStockBtn.onclick = () => {
        const text = mainArea.value;
        if (!text) return;
        stockItems.push(text);
        renderStockList();
    };

    // --- 素材エリア操作 ---

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
        };

        deleteRowBtn.onclick = () => {
            row.remove();
        };
    }

    document.querySelectorAll('.material-row').forEach(row => setupRowEvents(row));

    addNewRowBtn.onclick = () => {
        const newRow = document.createElement('div');
        newRow.className = "flex gap-2 material-row";
        newRow.innerHTML = `
            <input type="text" class="flex-1 p-3 bg-gray-50 border-0 rounded-xl font-bold outline-none material-input" placeholder="素材を入力">
            <button class="px-6 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-black transition add-to-main-btn">追加</button>
            <button class="px-4 py-3 bg-red-50 text-red-400 rounded-xl font-bold hover:bg-red-100 transition delete-row-btn">🗑️</button>
        `;
        container.appendChild(newRow);
        setupRowEvents(newRow);
    };

    // --- 保存済みリスト描画（追加ボタンを実装） ---

    function renderStockList() {
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

    // --- window公開関数 ---

    // リストの文字を作成エリアの末尾に足す
    window.appendStock = (index) => {
        saveState();
        mainArea.value += stockItems[index];
        updateUndoButton();
    };

    window.copyStock = async (index) => {
        const text = stockItems[index];
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            alert("クリップボードにコピーしました");
        } else {
            alert("環境の影響によりコピーできませんでした。編集ボタンで作成エリアに戻してからコピーしてください。");
        }
    };

    window.editStock = (index) => {
        if (mainArea.value && !confirm("現在の作成エリアを上書きしてもよろしいですか？")) return;
        saveState();
        mainArea.value = stockItems[index];
        history = []; // 上書き時は履歴をリセット
        updateUndoButton();
        window.scrollTo({ top: mainArea.offsetTop - 100, behavior: 'smooth' });
    };

    window.deleteStock = (index) => {
        if(confirm("この保存済み文字列を削除しますか？")) {
            stockItems.splice(index, 1);
            renderStockList();
        }
    };

    // --- コントロール ---

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

    copyBtn.onclick = async () => {
        if (!mainArea.value) return;
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(mainArea.value);
                const original = copyBtn.innerText;
                copyBtn.innerText = "✅ コピー完了！";
                setTimeout(() => copyBtn.innerText = original, 2000);
            } catch (err) {
                alert("コピーに失敗しました");
            }
        } else {
            alert("コピーに失敗しました。HTTPS環境で実行してください。");
        }
    };
});
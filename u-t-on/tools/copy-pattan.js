/**
 * copy-pattan.js
 */

let history = []; 
let stockItems = []; // 保存済み文字列の配列

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

    // 行のイベント（追加・削除）を設定する関数
    function setupRowEvents(row) {
        const input = row.querySelector('.material-input');
        const addBtn = row.querySelector('.add-to-main-btn');
        const deleteRowBtn = row.querySelector('.delete-row-btn');

        // メインエリアへ文字を追加
        addBtn.onclick = () => {
            const text = input.value; 
            if (!text) return;
            
            saveState();
            mainArea.value += text;
            updateUndoButton();
        };

        // 行そのものを削除
        deleteRowBtn.onclick = () => {
            // 最後の1行は消さない、あるいは確認なしで消すなど調整可能
            row.remove();
        };
    }

    // 最初にある行にイベントを設定
    document.querySelectorAll('.material-row').forEach(row => setupRowEvents(row));

    // 「＋」ボタンで新しい入力行を増やす
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

    // --- 保存済みリスト描画 ---

    function renderStockList() {
        stockList.innerHTML = '';
        stockItems.forEach((item, index) => {
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-3 bg-gray-50 rounded-xl gap-2 shadow-sm border border-gray-100";
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

    // --- window公開関数 ---

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
        saveState();
        mainArea.value = stockItems[index];
        history = [];
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
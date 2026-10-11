/**
 * any-counter.js
 * 「なんでもカウンター」のロジック実装
 */

// 状態管理
let state = {
    children: [], // { id, name, count }
    groups: []    // { id, name, memberIds }
};

// 初期データ（初めて開いた時用）
const defaultChild = () => ({
    id: Date.now() + Math.random().toString(36).substr(2, 9),
    name: '項目',
    count: 0
});

const defaultGroup = () => ({
    id: 'group_' + Date.now() + Math.random().toString(36).substr(2, 9),
    name: 'グループ',
    memberIds: []
});

/**
 * データの読み込み
 */
function loadData() {
    const saved = ToolUtils.readJSON('any_counter_data', null);
    if (saved && Array.isArray(saved.children) && Array.isArray(saved.groups)) {
        const ids = new Set();
        state.children = saved.children.filter(c => c && typeof c.id === 'string' && !ids.has(c.id) && ids.add(c.id)).map(c => ({ id: c.id, name: String(c.name ?? '項目'), count: Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number(c.count) || 0))) }));
        state.groups = saved.groups.filter(g => g && typeof g.id === 'string' && Array.isArray(g.memberIds)).map(g => ({ id: g.id, name: String(g.name ?? 'グループ'), memberIds: [...new Set(g.memberIds)].filter(id => ids.has(id)) }));
    }
    if (!state.children.length) state.children.push(defaultChild());
}

/**
 * データの保存
 */
function saveData() {
    ToolUtils.writeJSON('any_counter_data', state);
}

/**
 * 全体の描画
 */
function render() {
    renderTotal();
    renderChildren();
    renderGroups();
    saveData();
}

/**
 * 親カウンター（合計）の描画
 */
function renderTotal() {
    const total = state.children.reduce((acc, child) => acc + child.count, 0);
    const display = document.getElementById('totalDisplay');

    // カウントアップアニメーション（簡易版）
    const startValue = parseInt(display.textContent) || 0;
    if (startValue !== total) {
        animateValue(display, startValue, total, 300);
        display.classList.remove('animate-pop');
        void display.offsetWidth; // reflow
        display.classList.add('animate-pop');
    } else {
        display.textContent = total;
    }
}

/**
 * 数値のアニメーション
 */
function animateValue(obj, start, end, duration) {
    cancelAnimationFrame(obj.countAnimation);
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            obj.countAnimation = window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end;
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * 子カウンターの描画
 */
function renderChildren() {
    const container = document.getElementById('childContainer');
    const template = document.getElementById('childTemplate');
    container.innerHTML = '';

    const total = state.children.reduce((acc, child) => acc + child.count, 0);

    state.children.forEach(child => {
        const clone = template.content.cloneNode(true);
        const card = clone.querySelector('.counter-card');
        const nameInput = clone.querySelector('.name-input');
        const countValue = clone.querySelector('.count-value');
        const ratioDisplay = clone.querySelector('.ratio-display');
        const probDisplay = clone.querySelector('.prob-display');

        nameInput.value = child.name;
        countValue.textContent = child.count;

        // 割合と確率の計算
        if (total > 0) {
            const ratio = (child.count / total * 100).toFixed(1);
            ratioDisplay.textContent = `割合: ${ratio}%`;

            if (child.count > 0) {
                const prob = (total / child.count).toFixed(2);
                probDisplay.textContent = `確率: 1/${prob}`;
            } else {
                probDisplay.textContent = `確率: -`;
            }
        } else {
            ratioDisplay.textContent = `割合: 0%`;
            probDisplay.textContent = `確率: -`;
        }

        // イベントリスナー設定
        nameInput.addEventListener('change', (e) => {
            child.name = e.target.value;
            saveData();
            renderGroups(); // グループ内のセレクトボックスなどのために再描画
        });

        clone.querySelector('.btn-plus').onclick = () => updateCount(child.id, 1);
        clone.querySelector('.btn-plus10').onclick = () => updateCount(child.id, 10);
        clone.querySelector('.btn-minus').onclick = () => updateCount(child.id, -1);
        clone.querySelector('.btn-minus10').onclick = () => updateCount(child.id, -10);
        clone.querySelector('.delete-child-btn').onclick = () => deleteChild(child.id);

        container.appendChild(clone);
    });
}

/**
 * カウントの更新
 */
function updateCount(id, amount) {
    const child = state.children.find(c => c.id === id);
    if (child) {
        child.count = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, child.count + amount));
        render();
    }
}

// 子カウンターの削除
function deleteChild(id) {
    if (state.children.length <= 1) return;
    state.children = state.children.filter(c => c.id !== id);
    // グループからも削除
    state.groups.forEach(g => {
        g.memberIds = g.memberIds.filter(mid => mid !== id);
    });
    render();
}

/**
 * サブグループの描画
 */
function renderGroups() {
    const container = document.getElementById('groupContainer');
    const template = document.getElementById('groupTemplate');
    container.innerHTML = '';

    const total = state.children.reduce((acc, child) => acc + child.count, 0);

    state.groups.forEach(group => {
        const clone = template.content.cloneNode(true);
        const nameInput = clone.querySelector('.group-name-input');
        const countDisplay = clone.querySelector('.group-count');
        const ratioDisplay = clone.querySelector('.group-ratio');
        const probDisplay = clone.querySelector('.group-prob');
        const memberList = clone.querySelector('.member-list');

        nameInput.value = group.name;

        // グループ合計の計算
        const groupTotal = state.children
            .filter(c => group.memberIds.includes(c.id))
            .reduce((acc, c) => acc + c.count, 0);

        countDisplay.textContent = groupTotal;

        if (total > 0) {
            const ratio = (groupTotal / total * 100).toFixed(1);
            ratioDisplay.textContent = `合計の ${ratio}%`;

            if (groupTotal > 0) {
                const prob = (total / groupTotal).toFixed(2);
                probDisplay.textContent = `出現率 1/${prob}`;
            } else {
                probDisplay.textContent = `出現率 -`;
            }
        } else {
            ratioDisplay.textContent = `合計の 0%`;
            probDisplay.textContent = `出現率 -`;
        }

        // メンバー選択ボタン（トグル）
        state.children.forEach(child => {
            const btn = document.createElement('button');
            const isActive = group.memberIds.includes(child.id);
            btn.className = `px-3 py-1 rounded-full text-[10px] font-bold transition-all border ${
                isActive ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-400 hover:border-indigo-300'
            }`;
            btn.textContent = child.name || '項目';
            btn.onclick = () => {
                if (isActive) {
                    group.memberIds = group.memberIds.filter(id => id !== child.id);
                } else {
                    group.memberIds.push(child.id);
                }
                render();
            };
            memberList.appendChild(btn);
        });

        nameInput.addEventListener('change', (e) => {
            group.name = e.target.value;
            saveData();
        });

        clone.querySelector('.delete-group-btn').onclick = () => {
            state.groups = state.groups.filter(g => g.id !== group.id);
            render();
        };

        container.appendChild(clone);
    });
}

// 全リセット
function resetAll() {
    if (!confirm('すべてのカウントを0に戻しますか？')) return;
    state.children.forEach(c => c.count = 0);
    render();
}

/**
 * CSVエクスポート
 */
function exportCSV() {
    const rows = [['Type', 'ID', 'Name', 'Value/Members'], ...state.children.map(c => ['Child', c.id, c.name, c.count]), ...state.groups.map(g => ['Group', g.id, g.name, g.memberIds.join('|')])];
    const csv = rows.map(row => row.map(ToolUtils.csvField).join(',')).join('\r\n');
    ToolUtils.downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), 'any-counter_' + new Date().toISOString().slice(0, 10) + '.csv');
}
function importCSV(file) {
    const reader = new FileReader();
    reader.onload = event => {
        try {
            const rows = ToolUtils.parseCSV(event.target.result);
            if (rows[0]?.join(',') !== 'Type,ID,Name,Value/Members') throw new Error('カウンター用のCSVを選択してください。');
            const children = [], groups = [], ids = new Set();
            for (const [type, id, name, value] of rows.slice(1)) {
                if (!type) continue;
                if (!id || name === undefined || value === undefined) throw new Error('CSVの列が不足しています。');
                if (type === 'Child') {
                    const count = Number(value);
                    if (ids.has(id) || !Number.isSafeInteger(count) || count < 0) throw new Error('項目IDやカウントの値が不正です。');
                    ids.add(id); children.push({ id, name, count });
                } else if (type === 'Group') groups.push({ id, name, memberIds: value.split('|').filter(Boolean) });
                else throw new Error('CSVの種類が不正です。');
            }
            if (!children.length) throw new Error('カウント項目がありません。');
            groups.forEach(g => { g.memberIds = [...new Set(g.memberIds)].filter(id => ids.has(id)); });
            if (!confirm('現在のカウンターをCSVの内容で上書きしますか？')) return;
            state = { children, groups }; render(); ToolUtils.notify('CSVを読み込みました。');
        } catch (error) { ToolUtils.notify(error.message); }
    };
    reader.onerror = () => ToolUtils.notify('CSVを読み込めませんでした。');
    reader.readAsText(file);
}

// イベントリスナーのセットアップ
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    render();

    document.getElementById('addChildBtn').onclick = () => {
        state.children.push(defaultChild());
        render();
    };

    document.getElementById('addGroupBtn').onclick = () => {
        state.groups.push(defaultGroup());
        render();
    };

    document.getElementById('resetAllBtn').onclick = resetAll;

    document.getElementById('saveCsvBtn').onclick = exportCSV;

    const fileInput = document.getElementById('csvFileInput');
    document.getElementById('loadCsvBtn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) {
            importCSV(e.target.files[0]);
            e.target.value = ''; // 連続で同じファイルを読み込めるようにリセット
        }
    };
});

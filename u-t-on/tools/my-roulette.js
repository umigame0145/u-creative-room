/**
 * my-roulette.js
 * 「myルーレット」のロジック実装
 */

// --- 状態管理 ---
let state = {
    items: [
        { id: '1', name: '大吉', weight: 1, color: '#ff4444' },
        { id: '2', name: '中吉', weight: 3, color: '#ffaa00' },
        { id: '3', name: '小吉', weight: 5, color: '#ffcc00' },
        { id: '4', name: '吉', weight: 10, color: '#44ccff' }
    ],
    config: {
        mode: 'probability', // 'probability' or 'subtraction'
        weightType: 'ratio',  // 'ratio' or 'percent'
        hideSettings: false,
        uniformAppearance: false
    },
    // 減算モード等で利用する現在の一時的な重み
    currentWeights: [], 
    history: [],
    pendingWinner: null
};

// アニメーション用変数
let angle = 0;
let speed = 0;
let isSpinning = false; // 旧コード互換性のため維持
let animState = 'none'; // 'none', 'spinning', 'stopping'
let targetAngle = 0;

// アニメーション用（時間ベース）
let stopStartTime = 0;
let stopStartAngle = 0;
const stopDuration = 1500; // 1.5秒で停止

const canvas = document.getElementById('rouletteCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

// --- 初期化 ---
function init() {
    loadState();
    setupEventListeners();
    // すでにロードされている場合はリセットしない
    if (!state.currentWeights || state.currentWeights.length === 0) {
        resetCurrentWeights();
    }
    render();
}

// データの読み込み
function loadState() {
    const saved = localStorage.getItem('my_roulette_data');
    if (saved) {
        const parsed = JSON.parse(saved);
        // 保存データをマージ（新規追加されたconfig項目を保護するため）
        if (parsed.items) state.items = parsed.items;
        if (parsed.config) state.config = { ...state.config, ...parsed.config };
        if (parsed.history) state.history = parsed.history;
        
        // 数値であることを保証
        state.items.forEach(item => {
            item.weight = Number(item.weight) || 0;
        });

        // 減算モードの状態復元
        if (parsed.currentWeights) {
            state.currentWeights = parsed.currentWeights;
            // ロード後にID整合性をチェック（項目削除などに対応）
            state.currentWeights = state.currentWeights.filter(cw => state.items.some(i => i.id === cw.id));
        }
    }
}

// データの保存
function saveState() {
    localStorage.setItem('my_roulette_data', JSON.stringify(state));
}

// --- 重み管理 ---
function resetCurrentWeights() {
    state.currentWeights = state.items.map(item => ({
        id: item.id,
        weight: item.weight,
        active: item.weight > 0
    }));
}

// 有効な項目の計算
function getActiveItems() {
    let source = (state.config.mode === 'subtraction') ? state.currentWeights : state.items.map(i => ({...i, active: true}));
    
    // IDで紐付け
    return state.items.map((item, idx) => {
        const current = source.find(s => s.id === item.id);
        return {
            ...item,
            currentWeight: current ? current.weight : 0,
            active: current ? current.active : false
        };
    }).filter(i => i.active && i.currentWeight > 0);
}

// --- 描画ロジック ---
function render() {
    drawWheel();
    renderItemList();
    renderHistory();
    updateButtons();
}

function drawWheel() {
    const isUniform = Boolean(state.config.uniformAppearance);
    const visualItems = isUniform ? state.items : getActiveItems();
    const totalWeight = isUniform ? visualItems.length : visualItems.reduce((acc, item) => acc + item.currentWeight, 0);
    
    console.log(`[drawWheel] isUniform: ${isUniform}, items: ${visualItems.length}, totalWeight: ${totalWeight}`);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 20;

    if (totalWeight === 0) {
        ctx.fillStyle = '#eee';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    let startAngle = angle;
    visualItems.forEach(item => {
        const sliceAngle = isUniform ? (Math.PI * 2 / visualItems.length) : (item.currentWeight / totalWeight) * Math.PI * 2;
        
        const currentWeight = isUniform ? 1 : item.currentWeight;

        // セグメント描画
        ctx.fillStyle = item.color;
        
        // 減算モードで見ため一律の場合、中身が0の項目は少し薄くするなどの演出も考えられるが、
        // ユーザーの「初回の一律な見た目を維持する」という意図を尊重し、そのまま描画する。
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 輪郭
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();

        // ラベル描画
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px sans-serif';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.fillText(item.name, radius - 40, 10);
        ctx.restore();

        startAngle += sliceAngle;
    });
}

function renderItemList() {
    const container = document.getElementById('itemList');
    const template = document.getElementById('itemTemplate');
    container.innerHTML = '';

    state.items.forEach((item, index) => {
        const current = state.currentWeights.find(s => s.id === item.id) || item;
        const clone = template.content.cloneNode(true);
        const row = clone.querySelector('.item-row');
        const colorInput = clone.querySelector('.item-color');
        const nameInput = clone.querySelector('.item-name');
        const weightInput = clone.querySelector('.item-weight');
        const unit = clone.querySelector('.weight-unit');
        const deleteBtn = clone.querySelector('.delete-item-btn');

        colorInput.value = item.color;
        nameInput.value = item.name;
        
        // 減算モード時は現在の残り数を表示、そうでなければ設定値を表示
        const displayWeight = (state.config.mode === 'subtraction') ? current.weight : item.weight;
        weightInput.value = displayWeight;
        
        // 以前は減算モード時に編集不可にしていたが、ユーザー要望により解除
        // ただし、値を変更した場合は安全のため resetCurrentWeights() が呼ばれるようにする
        if (state.config.mode === 'subtraction') {
            if (!current.active) row.classList.add('opacity-30', 'grayscale');
        }

        // 単位の動的表示
        unit.textContent = (state.config.weightType === 'percent') ? '%' : '個';

        if (state.config.hideSettings) {
            colorInput.disabled = true;
            nameInput.disabled = true;
            weightInput.disabled = true;
            deleteBtn.disabled = true;
        }

        if (index === 0 && state.items.length === 1) {
            deleteBtn.classList.add('invisible');
        }

        // イベント設定
        colorInput.oninput = (e) => { item.color = e.target.value; render(); saveState(); };
        nameInput.onchange = (e) => { item.name = e.target.value; render(); saveState(); };
        weightInput.onchange = (e) => { 
            const val = parseFloat(e.target.value);
            item.weight = isNaN(val) ? 0 : val;
            resetCurrentWeights(); // 設定変更時は現在の重みもリセット
            render(); 
            saveState(); 
        };
        deleteBtn.onclick = () => {
            if (state.items.length > 1) {
                state.items.splice(index, 1);
                resetCurrentWeights();
                render();
                saveState();
            }
        };

        container.appendChild(clone);
    });
}

function renderHistory() {
    const container = document.getElementById('historyList');
    container.innerHTML = '';
    if (state.history.length === 0) {
        container.innerHTML = '<div class="text-center py-10 text-gray-300 text-xs italic">履歴はありません</div>';
        return;
    }

    state.history.slice().reverse().forEach(entry => {
        const div = document.createElement('div');
        div.className = 'history-item flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl shadow-sm';
        div.innerHTML = `
            <div class="w-2 h-8 rounded-full" style="background-color: ${entry.color}"></div>
            <div class="flex-grow">
                <div class="text-[10px] text-gray-400">${new Date(entry.time).toLocaleString()}</div>
                <div class="text-sm font-black text-gray-700">${entry.name}</div>
            </div>
        `;
        container.appendChild(div);
    });
}

function updateButtons() {
    const modeProbBtn = document.getElementById('modeProbBtn');
    const modeSubBtn = document.getElementById('modeSubBtn');
    
    if (state.config.mode === 'probability') {
        modeProbBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all bg-white shadow-sm';
        modeSubBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all text-gray-400 hover:text-gray-600';
    } else {
        modeSubBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all bg-white shadow-sm';
        modeProbBtn.className = 'flex-1 py-2 text-xs font-bold rounded-xl transition-all text-gray-400 hover:text-gray-600';
    }

    startBtn.disabled = isSpinning;
    
    if (state.pendingWinner) {
        startBtn.textContent = 'SET (確定)';
        startBtn.className = 'flex-grow py-5 bg-green-600 text-white rounded-[2rem] text-xl font-black shadow-lg hover:bg-green-700 hover:scale-105 active:scale-95 transition-all';
        startBtn.disabled = false;
    } else {
        startBtn.textContent = 'START';
        startBtn.className = isSpinning ? 'flex-grow py-5 bg-gray-400 text-white rounded-[2rem] text-xl font-black shadow-lg cursor-not-allowed' : 'flex-grow py-5 bg-blue-600 text-white rounded-[2rem] text-xl font-black shadow-lg hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all';
        if (isSpinning) startBtn.disabled = true;
    }
    
    stopBtn.disabled = animState !== 'spinning';
        stopBtn.className = animState !== 'spinning' ? 'flex-grow py-5 bg-gray-400 text-white rounded-[2rem] text-xl font-black shadow-lg cursor-not-allowed' : 'flex-grow py-5 bg-orange-500 text-white rounded-[2rem] text-xl font-black shadow-lg hover:bg-orange-600 active:scale-95 animate-pulse';

    // ぼかし設定の反映
    const itemList = document.getElementById('itemList');
    const modeToggle = document.getElementById('modeToggleContainer');
    const weightSettings = document.querySelector('input[name="weightType"]').closest('div.flex');
    const addItemBtn = document.getElementById('addItemBtn');
    const csvSettings = document.getElementById('saveCsvBtn').closest('div');

    if (state.config.hideSettings) {
        itemList.classList.add('blur-settings');
        modeToggle.classList.add('blur-settings');
        weightSettings.classList.add('blur-settings');
        addItemBtn.classList.add('blur-settings', 'opacity-50');
        csvSettings.classList.add('blur-settings');
        
        document.querySelectorAll('input[name="weightType"]').forEach(i => i.disabled = true);
        addItemBtn.disabled = true;
    } else {
        itemList.classList.remove('blur-settings');
        modeToggle.classList.remove('blur-settings');
        weightSettings.classList.remove('blur-settings');
        addItemBtn.classList.remove('blur-settings', 'opacity-50');
        csvSettings.classList.remove('blur-settings');
        
        document.querySelectorAll('input[name="weightType"]').forEach(i => i.disabled = false);
        addItemBtn.disabled = false;
    }

    // 全体残数の表示
    const totalCountContainer = document.getElementById('totalCountContainer');
    const totalCountValue = document.getElementById('totalCountValue');
    if (state.config.mode === 'subtraction' && state.config.uniformAppearance) {
        totalCountContainer.classList.remove('hidden');
        const currentTotal = state.currentWeights.reduce((acc, i) => acc + (i.active ? i.weight : 0), 0);
        const initialTotal = state.items.reduce((acc, i) => acc + i.weight, 0);
        totalCountValue.textContent = `${currentTotal} / ${initialTotal}`;
    } else {
        totalCountContainer.classList.add('hidden');
    }

    // チェックボックス・ラジオの状態同期
    document.getElementById('hideSettingsCheckbox').checked = state.config.hideSettings;
    document.getElementById('uniformAppearanceCheckbox').checked = state.config.uniformAppearance;
    
    const weightRadios = document.querySelectorAll('input[name="weightType"]');
    weightRadios.forEach(radio => {
        radio.checked = (radio.value === state.config.weightType);
    });
}

// --- 抽選・アニメーション ---
function animationLoop() {
    if (animState === 'none') return;

    if (animState === 'spinning') {
        angle += speed;
        if (speed < 0.2) {
            speed += 0.005;
        } else if (speed < 0.4) {
            speed += 0.001;
        }
    } else if (animState === 'stopping') {
        const now = performance.now();
        const elapsed = now - stopStartTime;
        const t = Math.min(1, elapsed / stopDuration);
        
        // 四次イージング (Quartic Ease-Out) - 三次よりさらに終盤がゆったり
        const easedT = 1 - Math.pow(1 - t, 4);
        
        angle = stopStartAngle + (targetAngle - stopStartAngle) * easedT;
        
        if (t >= 1) {
            angle = targetAngle;
            animState = 'none';
            isSpinning = false;
            drawWheel();
            finishSpin();
            return;
        }
    }

    drawWheel();
    requestAnimationFrame(animationLoop);
}

function spin() {
    if (animState !== 'none') return;
    if (state.pendingWinner) return;

    const activeItems = getActiveItems();
    if (activeItems.length === 0) {
        alert('有効な項目がありません！');
        return;
    }

    animState = 'spinning';
    isSpinning = true;
    speed = 0.5;
    document.getElementById('resultDisplay').innerHTML = '';
    updateButtons();
    animationLoop();
}

function stop() {
    if (animState !== 'spinning') return;
    
    const winner = pickWinnerByWeight();
    state.pendingWinner = winner;

    targetAngle = getTargetAngle(winner);
    
    animState = 'stopping';
    stopStartTime = performance.now();
    stopStartAngle = angle;
    updateButtons();
}

/**
 * 重みに基づいて当選項目を決定する
 */
function pickWinnerByWeight() {
    const activeItems = getActiveItems();
    const totalWeight = activeItems.reduce((acc, item) => acc + item.currentWeight, 0);
    if (totalWeight <= 0) return activeItems[0];

    let r = Math.random() * totalWeight;
    for (const item of activeItems) {
        if (r < item.currentWeight) return item;
        r -= item.currentWeight;
    }
    return activeItems[activeItems.length - 1];
}

/**
 * 当選項目が真上に来るためのターゲット角度を計算する
 */
function getTargetAngle(winner) {
    const isUniform = Boolean(state.config.uniformAppearance);
    const visualItems = isUniform ? state.items : getActiveItems();
    const totalWeight = isUniform ? visualItems.length : visualItems.reduce((acc, item) => acc + item.currentWeight, 0);
    
    let currentPos = 0;
    for (const item of visualItems) {
        const slice = isUniform ? (Math.PI * 2 / visualItems.length) : (item.currentWeight / totalWeight) * Math.PI * 2;
        if (item.id === winner.id) {
            // セグメントの中央をポインターに合わせる
            const targetInWheel = currentPos + slice / 2;
            
            // 矢印の位置（-PI/2）に targetInWheel が来る角度を求める
            let target = -Math.PI / 2 - targetInWheel;
            
            // 現在の角度より大きく、かつ最低でも N回転 させる
            const minRotation = Math.PI * 2 * 3; // 最低3回転
            while (target < angle + minRotation) {
                target += Math.PI * 2;
            }
            return target;
        }
        currentPos += slice;
    }
    return angle + Math.PI * 4; // フォールバック
}

function finishSpin() {
    // すでに state.pendingWinner に当選者が入っているはず
    if (!state.pendingWinner) {
        const activeItems = getActiveItems();
        const totalWeight = activeItems.reduce((acc, item) => acc + item.currentWeight, 0);
        let normalized = (-Math.PI / 2 - angle) % (Math.PI * 2);
        while (normalized < 0) normalized += Math.PI * 2;

        let currentPos = 0;
        let winner = activeItems[0];
        for (const item of activeItems) {
            const slice = (item.currentWeight / totalWeight) * Math.PI * 2;
            if (normalized >= currentPos && normalized < currentPos + slice) {
                winner = item;
                break;
            }
            currentPos += slice;
        }
        state.pendingWinner = winner;
    }

    const winner = state.pendingWinner;
    showResult(winner.name);
    updateButtons();
}

function handleSet() {
    if (!state.pendingWinner) return;

    const winner = state.pendingWinner;

    // ここで初めて履歴追加と減算を行う
    state.history.push({
        id: winner.id,
        name: winner.name,
        color: winner.color,
        time: Date.now()
    });

    // 減算モードの処理
    if (state.config.mode === 'subtraction') {
        const currentItem = state.currentWeights.find(s => s.id === winner.id);
        if (currentItem) {
            if (state.config.weightType === 'percent') {
                currentItem.active = false;
            } else {
                currentItem.weight = Math.max(0, currentItem.weight - 1);
                if (currentItem.weight === 0) currentItem.active = false;
            }
        }
    }

    state.pendingWinner = null;
    document.getElementById('resultDisplay').innerHTML = '';
    render();
    saveState();
}

function showResult(name) {
    const display = document.getElementById('resultDisplay');
    display.innerHTML = `<div class="text-2xl font-black text-blue-600 animate-bounce">【${name}】が当選しました！</div>`;
}

// --- イベント設定 ---
function setupEventListeners() {
    startBtn.onclick = () => {
        if (state.pendingWinner) {
            handleSet();
        } else {
            spin();
        }
    };
    stopBtn.onclick = stop;

    document.getElementById('modeProbBtn').onclick = () => { state.config.mode = 'probability'; resetCurrentWeights(); render(); saveState(); };
    document.getElementById('modeSubBtn').onclick = () => { state.config.mode = 'subtraction'; resetCurrentWeights(); render(); saveState(); };

    document.querySelectorAll('input[name="weightType"]').forEach(input => {
        input.onchange = (e) => {
            state.config.weightType = e.target.value;
            resetCurrentWeights();
            render();
            saveState();
        };
    });

    document.getElementById('hideSettingsCheckbox').onchange = (e) => {
        state.config.hideSettings = e.target.checked;
        render();
        saveState();
    };
    document.getElementById('uniformAppearanceCheckbox').onchange = (e) => {
        state.config.uniformAppearance = e.target.checked;
        render();
        saveState();
    };

    document.getElementById('addItemBtn').onclick = () => {
        const id = Date.now().toString();
        const colors = ['#ff4444', '#ffaa00', '#ffcc00', '#44ccff', '#44ff44', '#cc44ff', '#ff44cc'];
        const color = colors[state.items.length % colors.length];
        state.items.push({ id, name: '項目' + (state.items.length + 1), weight: 1, color });
        resetCurrentWeights();
        render();
        saveState();
    };

    const historyClearHandler = () => {
        if (confirm('履歴をクリアし、減算状態をリセットしますか？')) {
            state.history = [];
            resetCurrentWeights();
            document.getElementById('resultDisplay').innerHTML = '';
            console.log('History and weights cleared');
            render();
            saveState();
        }
    };
    document.getElementById('clearHistoryBtn').onclick = historyClearHandler;
    const clearTopBtn = document.getElementById('clearHistoryBtnTop');
    if (clearTopBtn) clearTopBtn.onclick = historyClearHandler;

    // CSV
    document.getElementById('saveCsvBtn').onclick = exportCSV;
    const fileInput = document.getElementById('csvFileInput');
    document.getElementById('loadCsvBtn').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if (e.target.files.length > 0) importCSV(e.target.files[0]);
        e.target.value = '';
    };
}

function exportCSV() {
    let csv = 'ID,Name,Weight,Color\n';
    state.items.forEach(i => {
        csv += `${i.id},"${i.name}",${i.weight},${i.color}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `roulette_config_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

function importCSV(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const lines = e.target.result.split('\n');
        const newItems = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length < 4) continue;
            newItems.push({
                id: parts[0],
                name: parts[1].replace(/"/g, ''),
                weight: parseFloat(parts[2]) || 0,
                color: parts[3]
            });
        }
        if (newItems.length > 0) {
            state.items = newItems;
            resetCurrentWeights();
            render();
            saveState();
            alert('設定を読み込みました。');
        }
    };
    reader.readAsText(file);
}

// 起動
init();

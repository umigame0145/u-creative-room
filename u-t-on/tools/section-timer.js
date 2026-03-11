/**
 * section-timer.js
 */

document.addEventListener('DOMContentLoaded', () => {
    // 要素取得
    const timerDisplay = document.getElementById('timerDisplay');
    const statusLabel = document.getElementById('statusLabel');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const overlay = document.getElementById('overlayControl');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const browserFullBtn = document.getElementById('browserFullBtn'); // 追加
    const mainDisplay = document.getElementById('mainDisplay');

    const modeDuration = document.getElementById('modeDuration');
    const modeTarget = document.getElementById('modeTarget');
    const inputDurationArea = document.getElementById('inputDuration');
    const inputTargetArea = document.getElementById('inputTarget');

    let countdownInterval;
    let endTime; // 終了予定時刻
    let currentMode = 'duration'; // 'duration' or 'target'

    // --- ページ内最大化用のスタイル注入 ---
    const style = document.createElement('style');
    style.textContent = `
        .pseudo-fullscreen {
            position: fixed !important; top: 0; left: 0; width: 100vw; height: 100vh;
            z-index: 9999; margin: 0; border-radius: 0;
        }
        @keyframes scroll-loop {
            0% { transform: translateX(0); }
            100% { transform: translateX(calc(-50% - 0.5em)); } /* スペース分を考慮 */
        }
        .animate-scroll {
            display: inline-block;
            animation: scroll-loop 8s linear infinite; /* 少し速めに調整 */
        }
    `;
    document.head.appendChild(style);

    // --- モード切替 ---
    modeDuration.onclick = () => {
        currentMode = 'duration';
        toggleModeUI(modeDuration, modeTarget, inputDurationArea, inputTargetArea);
    };

    modeTarget.onclick = () => {
        currentMode = 'target';
        toggleModeUI(modeTarget, modeDuration, inputTargetArea, inputDurationArea);
    };

    function toggleModeUI(activeBtn, inactiveBtn, showArea, hideArea) {
        activeBtn.classList.add('bg-white', 'shadow-sm');
        activeBtn.classList.remove('text-gray-500');
        inactiveBtn.classList.remove('bg-white', 'shadow-sm');
        inactiveBtn.classList.add('text-gray-500');
        showArea.classList.remove('hidden');
        hideArea.classList.add('hidden');
    }

    // --- タイマー制御 ---

    function updateDisplay(ms) {
        if (ms < 0) ms = 0;
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        
        timerDisplay.textContent = 
            `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function startTimer() {
        const now = new Date();
        
        if (currentMode === 'duration') {
            const mins = parseInt(document.getElementById('inputMin').value) || 0;
            const secs = parseInt(document.getElementById('inputSec').value) || 0;
            const totalMs = (mins * 60 + secs) * 1000;
            endTime = new Date(now.getTime() + totalMs);
        } else {
            const timeVal = document.getElementById('targetTime').value;
            if (!timeVal) return alert("目標時刻を指定してください");
            
            const [h, m] = timeVal.split(':');
            endTime = new Date();
            endTime.setHours(h, m, 0, 0);
            
            // 指定時刻が過去なら翌日に設定
            if (endTime <= now) {
                endTime.setDate(endTime.getDate() + 1);
            }
        }

        overlay.classList.add('hidden');
        statusLabel.textContent = "Running";
        
        clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            const diff = endTime - new Date();
            if (diff <= 0) {
                finishTimer();
            } else {
                updateDisplay(diff);
            }
        }, 100); // 0.1秒ごとにチェック
    }

    function finishTimer() {
        clearInterval(countdownInterval);
        updateDisplay(0);
        statusLabel.textContent = "Time Up!";
        statusLabel.classList.add('text-red-500', 'animate-pulse');
        // 今後ここにアラーム音を追加
    }

    function resetTimer() {
        clearInterval(countdownInterval);
        overlay.classList.remove('hidden');
        statusLabel.textContent = "Ready";
        statusLabel.classList.remove('text-red-500', 'animate-pulse');
        updateDisplay(0);
        updateSectionName(false); // ★ここ：文字を消す
    }

    function updateSectionName(isActive = true) {
        const display = document.getElementById('sectionNameDisplay');
        const container = document.getElementById('sectionNameContainer');
        const input = document.getElementById('inputSectionName');
        
        if (!isActive || !input.value.trim()) {
            display.textContent = "";
            display.classList.remove('animate-scroll');
            return;
        }

        const text = input.value.trim();
        display.textContent = text;
        display.classList.remove('animate-scroll');
        
        // コンテナ（タイマー幅相当）より文字が長いか判定
        // 判定を確実にするため少し時間を置くか、offsetWidthを利用
        const isOverflow = display.offsetWidth > container.offsetWidth;

        if (isOverflow) {
            // 「テキスト + 全角スペース + テキスト + 全角スペース」でループ
            display.textContent = `${text}\u3000${text}\u3000`; 
            display.classList.add('animate-scroll');
            container.style.justifyContent = 'flex-start';
        } else {
            container.style.justifyContent = 'center';
        }
    }

    // --- イベント ---

    startBtn.onclick = () => {
        updateSectionName(true); // 表示開始
        startTimer();
    };

    resetBtn.onclick = () => {
        resetTimer();
    };

    // 1. ページ内最大化（擬似フルスクリーン）の切り替え
    if (browserFullBtn) {
        browserFullBtn.onclick = () => {
            mainDisplay.classList.toggle('pseudo-fullscreen');
            
            // 擬似フルスクリーン有効時はEscキーで解除できるようにする
            if (mainDisplay.classList.contains('pseudo-fullscreen')) {
                const escHandler = (e) => {
                    if (e.key === 'Escape') {
                        mainDisplay.classList.remove('pseudo-fullscreen');
                        window.removeEventListener('keydown', escHandler);
                    }
                };
                window.addEventListener('keydown', escHandler);
            }
        };
    }

    // 2. システムレベルの全画面表示の切り替え
    fullscreenBtn.onclick = () => {
        if (!document.fullscreenElement) {
            mainDisplay.requestFullscreen().catch(err => {
                alert(`Error: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // フルスクリーン状態の変化を監視してスタイル調整
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            mainDisplay.classList.add('rounded-none');
        } else {
            mainDisplay.classList.remove('rounded-none');
        }
    });
});
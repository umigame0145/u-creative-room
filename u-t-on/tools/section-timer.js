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
    const mainDisplay = document.getElementById('mainDisplay');

    const modeDuration = document.getElementById('modeDuration');
    const modeTarget = document.getElementById('modeTarget');
    const inputDurationArea = document.getElementById('inputDuration');
    const inputTargetArea = document.getElementById('inputTarget');

    let countdownInterval;
    let endTime; // 終了予定時刻
    let currentMode = 'duration'; // 'duration' or 'target'

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
    }

    // --- イベント ---

    startBtn.onclick = () => {
        startTimer();
    };

    resetBtn.onclick = () => {
        resetTimer();
    };

    // 全画面表示の切り替え
    fullscreenBtn.onclick = () => {
        if (!document.fullscreenElement) {
            mainDisplay.requestFullscreen().catch(err => {
                alert(`Error: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };
});
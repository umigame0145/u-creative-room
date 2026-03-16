/**
 * セクションタイマー - 制御ロジック
 * Version: 2.5.6
 */
console.log("Section Timer JS Loaded: v2.5.6");

// --- グローバル時間調整関数 ---
window.adjustTime = (idOrEl, amount) => {
    const input = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!input) return;
    let val = parseInt(input.value) || 0;
    val += amount;

    if (input.min !== "" && val < parseInt(input.min)) val = parseInt(input.min);
    if (input.max !== "" && val > parseInt(input.max)) val = parseInt(input.max);

    const isTimeField = (input.id && (input.id.includes('Hour') || input.id.includes('Min') || input.id.includes('Sec'))) ||
        input.classList.contains('sub-hour') ||
        input.classList.contains('sub-min') ||
        input.classList.contains('sub-sec');

    input.value = isTimeField ? String(val).padStart(2, '0') : val;

    if (input.closest('.sub-card')) {
        validateSubSection(input.closest('.sub-card'));
    }
};

function validateSubSection(card) {
    const typeSelect = card.querySelector('.sub-type');
    const hourInput = card.querySelector('.sub-hour');
    const minInput = card.querySelector('.sub-min');
    const secInput = card.querySelector('.sub-sec');
    const warning = card.querySelector('.sub-warning');
    if (!typeSelect || !hourInput || !minInput || !secInput || !warning) return;

    const hInput = document.getElementById('mainHour');
    const mInput = document.getElementById('mainMin');
    const sInput = document.getElementById('mainSec');
    if (!hInput || !mInput || !sInput) return;

    const mainDurationMs = (parseInt(hInput.value || 0) * 3600 + parseInt(mInput.value || 0) * 60 + parseInt(sInput.value || 0)) * 1000;
    const subTimeMs = (parseInt(hourInput.value || 0) * 3600 + parseInt(minInput.value || 0) * 60 + parseInt(secInput.value || 0)) * 1000;

    let isInvalid = false;
    if (typeSelect.value === 'duration' || typeSelect.value === 'elapsed') {
        if (subTimeMs >= mainDurationMs) isInvalid = true;
    }
    warning.classList.toggle('hidden', !isInvalid);
}

function initSectionTimer() {
    const timerDisplay = document.getElementById('timerDisplay');
    const totalRemainingDisplay = document.getElementById('totalRemainingDisplay');
    const nextMilestoneDisplay = document.getElementById('nextMilestoneDisplay');
    const nextMilestoneName = document.getElementById('nextMilestoneName');

    const statusLabel = document.getElementById('statusLabel');
    const startBtn = document.getElementById('startBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');

    const overlay = document.getElementById('overlayControl');
    const mainDisplay = document.getElementById('mainDisplay');
    const subSectionsContainer = document.getElementById('subSectionsContainer');
    const addSubSectionBtn = document.getElementById('addSubSectionBtn');

    const audioFileInput = document.getElementById('audioFileInput');
    const audioTracksContainer = document.getElementById('audioTracksContainer');
    const noAudioMsg = document.getElementById('noAudioMsg');
    const testSeBtn = document.getElementById('testSeBtn');

    if (!timerDisplay || !mainDisplay) return;

    let countdownInterval;
    let milestones = [];
    let currentMilestoneIndex = 0;
    let totalEndTime;
    let isRunning = false;
    let isPaused = false;
    let pausedRemainingMs = 0;
    let repeatBuzzerInterval = null;
    let subCardCounter = 0; // ID生成用カウンター

    // --- オーディオ管理 ---
    let audioTracks = [];
    let audioCtx = null;
    let activeSeAudio = null; // 現在再生中の通知音オブジェクト

    // --- BGM管理クラス ---
    class BgmManager {
        constructor() {
            this.playlist = [];
            this.currentIndex = 0;
            this.loop = true;
            this.activeAudio = null;
            this.isFading = false;
        }

        setPlaylist(trackIds, loop) {
            this.stop();
            this.playlist = trackIds.filter(id => id !== 'off');
            this.currentIndex = 0;
            this.loop = loop;
            this.isFading = false;
        }

        play() {
            if (this.playlist.length === 0) return;
            this.playTrack(this.currentIndex);
        }

        playTrack(index) {
            this.stopActive();
            const trackId = this.playlist[index];
            const track = audioTracks.find(t => t.id === trackId);
            if (!track) return;

            const audio = new Audio(track.url);
            audio.volume = track.volume;
            audio.loop = false; // 手動で次へ送るためfalse
            this.activeAudio = audio;

            audio.onended = () => {
                if (this.isFading) return;
                this.currentIndex++;
                if (this.currentIndex >= this.playlist.length) {
                    if (this.loop) {
                        this.currentIndex = 0;
                        this.playTrack(this.currentIndex);
                    } else {
                        this.activeAudio = null;
                    }
                } else {
                    this.playTrack(this.currentIndex);
                }
            };

            audio.play().catch(e => console.warn("BGM play failed:", e));
        }

        stopActive() {
            if (this.activeAudio) {
                this.activeAudio.pause();
                this.activeAudio.onended = null;
                this.activeAudio = null;
            }
        }

        stop() {
            this.stopActive();
            this.isFading = false;
        }

        updateFade(remainingMs) {
            if (!this.activeAudio || remainingMs > 1000) {
                this.isFading = false;
                return;
            }
            // 1s(1000ms) -> 0.1s(100ms) でボリュームを減衰させ、0.1sで 0 にする
            this.isFading = true;
            const progress = Math.max(0, (remainingMs - 100) / 900);
            const trackId = this.playlist[this.currentIndex];
            const track = audioTracks.find(t => t.id === trackId);
            const baseVol = track ? track.volume : 0.8;
            this.activeAudio.volume = baseVol * progress;

            if (remainingMs <= 100) {
                this.activeAudio.volume = 0;
                if (remainingMs <= 0) this.stop();
            }
        }
    }

    const bgmManager = new BgmManager();

    function getAudioCtx() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                audioCtx = new AudioContext();
                console.log("AudioContext initialized (State:", audioCtx.state, ")");
            }
        }
        return audioCtx;
    }

    async function ensureAudioActive() {
        const ctx = getAudioCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }
    }

    function playDefaultBuzzer() {
        stopActiveSe();
        const ctx = getAudioCtx();
        if (!ctx) return;

        try {
            // AudioContextの状態を確実にアクティブにする
            if (ctx.state === 'suspended') {
                ctx.resume();
            }

            const startTime = ctx.currentTime + 0.05; // わずかな遊びを持たせる
            const melody = [
                { f: 261.63, t: 0.0 },   // ド (C4)
                { f: 329.63, t: 0.25 },  // ミ (E4)
                { f: 523.25, t: 0.5 }    // 高いド (C5)
            ];

            const playPattern = (pStart) => {
                melody.forEach(note => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'triangle';

                    const noteTime = pStart + note.t;
                    osc.frequency.setValueAtTime(note.f, noteTime);

                    gain.gain.setValueAtTime(0, noteTime);
                    gain.gain.linearRampToValueAtTime(1.0, noteTime + 0.02); // 0.2 -> 1.0 (2倍)
                    gain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.24);

                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(noteTime);
                    osc.stop(noteTime + 0.25);
                });
            };

            playPattern(startTime);         // 1回目
            playPattern(startTime + 1.0);   // 2回目
        } catch (e) { console.error("playDefaultBuzzer error:", e); }
    }

    function startRepeatingSe(seId) {
        if (repeatBuzzerInterval) stopRepeatingBuzzer();

        const playOnce = async () => {
            await ensureAudioActive();
            if (seId === 'default') {
                playDefaultBuzzer();
            } else {
                playSE(seId);
            }
        };

        playOnce();
        // リピート間隔: デフォルトブザーは2秒、ほかは3秒程度（音声の長さを考慮）
        const interval = (seId === 'default') ? 2000 : 3500;
        repeatBuzzerInterval = setInterval(playOnce, interval);
    }

    function stopRepeatingBuzzer() {
        if (repeatBuzzerInterval) {
            clearInterval(repeatBuzzerInterval);
            repeatBuzzerInterval = null;
        }
    }

    // 再生中のSEを停止する
    function stopActiveSe() {
        if (activeSeAudio) {
            try {
                activeSeAudio.pause();
                activeSeAudio.currentTime = 0;
                activeSeAudio = null;
                console.log("Previous SE stopped.");
            } catch (e) {
                console.error("Error stopping SE:", e);
            }
        }
    }

    async function playSE(seId) {
        if (!seId || seId === 'off') {
            stopActiveSe();
            return;
        }

        await ensureAudioActive();

        if (seId === 'default') {
            playDefaultBuzzer();
            return;
        }

        const track = audioTracks.find(t => t.id === seId);
        if (track) {
            // 前のSEを停止
            stopActiveSe();

            try {
                const seAudio = new Audio(track.url);
                seAudio.volume = track.volume;
                seAudio.loop = false;

                activeSeAudio = seAudio; // 管理下に置く

                seAudio.play().catch(e => {
                    console.warn("SE play failed, falling back:", e);
                    // フォールバック
                    track.audio.currentTime = 0;
                    track.audio.loop = false;
                    activeSeAudio = track.audio;
                    track.audio.play().catch(() => { });
                });
            } catch (e) { console.error(e); }
        }
    }

    function renderAudioTracks() {
        if (!audioTracksContainer) return;
        if (noAudioMsg) noAudioMsg.classList.toggle('hidden', audioTracks.length > 0);
        audioTracksContainer.querySelectorAll('.track-item').forEach(el => el.remove());

        audioTracks.forEach(track => {
            const item = document.createElement('div');
            item.className = 'track-item flex items-center gap-4 bg-gray-50/50 p-4 rounded-3xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all';
            item.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-gray-700 truncate">${track.name}</p>
                    <div class="flex items-center gap-2 mt-1">
                        <button class="play-pause-btn text-[10px] font-black uppercase tracking-tighter text-pink-500 hover:text-pink-600">再生</button>
                        <div class="w-1 h-1 bg-gray-200 rounded-full"></div>
                        <span class="text-[9px] font-bold text-gray-400 uppercase">Vol: <span class="vol-num">${Math.round(track.volume * 100)}</span>%</span>
                    </div>
                </div>
                <input type="range" class="vol-slider w-24 h-1 bg-gray-200 rounded-full appearance-none cursor-pointer accent-pink-500" min="0" max="100" value="${track.volume * 100}">
                <button class="remove-track-btn text-gray-300 hover:text-red-400 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;

            const btn = item.querySelector('.play-pause-btn');
            btn.onclick = async () => {
                await ensureAudioActive();
                if (track.audio.paused) {
                    track.audio.loop = true;
                    track.audio.play();
                    btn.textContent = '停止';
                } else {
                    track.audio.pause();
                    btn.textContent = '再生';
                }
            };
            item.querySelector('.vol-slider').oninput = (e) => {
                const v = e.target.value / 100;
                track.audio.volume = v; track.volume = v;
                item.querySelector('.vol-num').textContent = e.target.value;
            };
            item.querySelector('.remove-track-btn').onclick = () => {
                track.audio.pause(); URL.revokeObjectURL(track.url);
                audioTracks = audioTracks.filter(t => t.id !== track.id);
                renderAudioTracks(); updateAllSeOptions();
            };
            audioTracksContainer.appendChild(item);
        });
    }

    function updateAllSeOptions() {
        document.querySelectorAll('.se-select').forEach(select => {
            const val = select.value;
            while (select.options.length > 2) select.remove(2);
            audioTracks.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id; opt.textContent = `再生: ${t.name}`;
                select.appendChild(opt);
            });
            if ([...select.options].some(o => o.value === val)) select.value = val;
            else if (val !== 'off' && val !== 'default') select.value = 'default';
        });
    }

    if (audioFileInput) {
        audioFileInput.onchange = (e) => {
            Array.from(e.target.files).forEach(file => {
                const id = 'audio_' + Math.random().toString(36).substr(2, 9);
                const url = URL.createObjectURL(file);
                const audio = new Audio(url);
                audio.volume = 0.8; audio.loop = true;
                audioTracks.push({ id, name: file.name, audio, url, volume: 0.8 });
            });
            renderAudioTracks(); updateAllSeOptions();
            audioFileInput.value = '';
        };
    }

    if (testSeBtn) {
        testSeBtn.onclick = async () => {
            await ensureAudioActive();
            playDefaultBuzzer();
        };
    }

    window.createSubSectionCard = function () {
        if (!subSectionsContainer) return;
        subCardCounter++;
        const id = Date.now() + '_' + subCardCounter;
        const card = document.createElement('div');
        card.className = 'sub-card bg-white rounded-[2rem] shadow-sm border border-gray-100 flex flex-col relative overflow-hidden transition-all hover:shadow-md';
        card.dataset.id = id;
        card.innerHTML = `
            <div class="absolute top-0 left-0 w-1.5 h-full bg-indigo-400"></div>
            <!-- メインコンテンツエリア -->
            <div class="p-6 pb-4 flex flex-col lg:flex-row gap-6 items-center">
                <div class="flex-1 w-full space-y-2">
                    <div class="flex flex-col gap-2">
                        <input type="text" class="sub-name w-full p-3 bg-gray-50 border-0 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-400 transition-all" placeholder="例：あと半分">
                        <select class="sub-type w-full p-3 bg-gray-100 border-0 rounded-2xl text-[10px] font-black outline-none cursor-pointer hover:bg-gray-200 transition-colors">
                            <option value="duration">残り時間</option>
                            <option value="target">時刻指定</option>
                            <option value="elapsed">経過時間</option>
                        </select>
                    </div>
                </div>
                <div class="w-full lg:w-auto space-y-2 flex flex-col items-center lg:items-end">
                    <div class="flex items-center gap-3 bg-gray-50 p-3 rounded-[2rem] border border-gray-100 shadow-inner">
                        <div class="flex flex-col items-center">
                            <button type="button" class="sub-inc-hour text-[10px] text-gray-300 hover:text-blue-500 transition-colors">▲</button>
                            <input type="number" class="sub-hour w-12 bg-transparent border-0 text-center text-xl font-black outline-none focus:text-blue-600 mini-input" value="00" min="0" max="99">
                            <button type="button" class="sub-dec-hour text-[10px] text-gray-300 hover:text-blue-500 transition-colors">▼</button>
                        </div>
                        <span class="text-xl font-black text-gray-200 mb-6">:</span>
                        <div class="flex flex-col items-center">
                            <button type="button" class="sub-inc-min text-[10px] text-gray-300 hover:text-blue-500 transition-colors">▲</button>
                            <input type="number" class="sub-min w-12 bg-transparent border-0 text-center text-xl font-black outline-none focus:text-blue-600 mini-input" value="05" min="0" max="59">
                            <button type="button" class="sub-dec-min text-[10px] text-gray-300 hover:text-blue-500 transition-colors">▼</button>
                        </div>
                        <span class="text-xl font-black text-gray-200 mb-6">:</span>
                        <div class="flex flex-col items-center">
                            <button type="button" class="sub-inc-sec text-[10px] text-gray-300 hover:text-blue-500 transition-colors">▲</button>
                            <input type="number" class="sub-sec w-12 bg-transparent border-0 text-center text-xl font-black outline-none focus:text-blue-600 mini-input" value="00" min="0" max="59">
                            <button type="button" class="sub-dec-sec text-[10px] text-gray-300 hover:text-blue-500 transition-colors">▼</button>
                        </div>
                    </div>
                    <div class="w-full mt-2">
                        <select class="se-select sub-se-select w-full p-2 bg-gray-50 border-0 rounded-xl text-[10px] font-bold outline-none cursor-pointer hover:bg-gray-100 transition-colors">
                            <option value="off">オフ</option>
                            <option value="default" selected>デフォルト（ブザー）</option>
                        </select>
                    </div>
                    <div class="sub-warning hidden text-[10px] text-red-500 font-bold mt-2 ml-1 flex items-center gap-1 animate-pulse">メインタイマー外</div>
                </div>
                <button class="remove-sub p-3 text-gray-200 hover:text-red-400 transition-all hover:bg-red-50 rounded-2xl shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 01-2-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                </button>
            </div>
            <!-- BGM設定 (サブ) -->
            <div class="w-full px-6 py-3 bg-indigo-50/30 flex items-center justify-between border-t border-indigo-50">
                <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1" id="bgmList_${id}">
                    <!-- BGMプルダウン -->
                </div>
                <div class="flex items-center gap-3 shrink-0 ml-2">
                    <button type="button" onclick="addBgmSelect('bgmList_${id}')" class="text-[9px] font-black text-indigo-400 hover:text-indigo-600">+ BGM</button>
                    <label class="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" class="sub-bgm-loop hidden peer" checked>
                        <div class="w-6 h-3 bg-gray-200 rounded-full relative peer-checked:bg-indigo-400 focus-within:ring-1 focus-within:ring-indigo-300">
                            <div class="absolute top-0.5 left-0.5 w-2 h-2 bg-white rounded-full transition-transform peer-checked:translate-x-3"></div>
                        </div>
                        <span class="text-[8px] font-black text-gray-400">LOOP</span>
                    </label>
                </div>
            </div>
        `;
        const h = card.querySelector('.sub-hour'), m = card.querySelector('.sub-min'), s = card.querySelector('.sub-sec');
        card.querySelector('.sub-inc-hour').onclick = () => adjustTime(h, 1); card.querySelector('.sub-dec-hour').onclick = () => adjustTime(h, -1);
        card.querySelector('.sub-inc-min').onclick = () => adjustTime(m, 1); card.querySelector('.sub-dec-min').onclick = () => adjustTime(m, -1);
        card.querySelector('.sub-inc-sec').onclick = () => adjustTime(s, 1); card.querySelector('.sub-dec-sec').onclick = () => adjustTime(s, -1);
        card.querySelector('.remove-sub').onclick = () => card.remove();
        [card.querySelector('.sub-type'), h, m, s].forEach(el => el.oninput = el.onchange = () => validateSubSection(card));
        subSectionsContainer.appendChild(card);

        // 初期BGMスロットを追加 (BGMなし状態)
        window.addBgmSelect(`bgmList_${id}`);

        updateAllSeOptions();
    };

    if (addSubSectionBtn) addSubSectionBtn.onclick = createSubSectionCard;

    window.addBgmSelect = function (containerId, initialValue = 'off') {
        const container = document.getElementById(containerId);
        if (!container) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center bg-white/50 rounded-lg pr-1 border border-gray-100 shadow-sm shrink-0';
        wrapper.innerHTML = `
            <select class="bgm-select p-1 bg-transparent text-[9px] font-bold outline-none cursor-pointer">
                <option value="off">BGMなし</option>
            </select>
            <button type="button" class="text-gray-300 hover:text-red-400 text-[10px] ml-1" onclick="this.parentElement.remove()">×</button>
        `;
        const select = wrapper.querySelector('select');
        audioTracks.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id; opt.textContent = t.name;
            select.appendChild(opt);
        });
        select.value = initialValue;
        container.appendChild(wrapper);
    };

    function formatTime(ms) {
        if (ms < 0) ms = 0;
        const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    window.startTimer = async function () {
        if (isRunning && !isPaused) return;
        await ensureAudioActive();
        if (isPaused) return resumeTimer();

        const mode = document.querySelector('input[name="mainTimeMode"]:checked');
        const hEl = document.getElementById('mainHour'), mEl = document.getElementById('mainMin'), sEl = document.getElementById('mainSec');
        if (!hEl || !mEl || !sEl || !mode) return;

        const mainMs = (mode.value === 'target') ?
            (function () { const t = new Date(); t.setHours(hEl.value, mEl.value, sEl.value, 0); if (t <= new Date()) t.setDate(t.getDate() + 1); return t - new Date(); })() :
            (parseInt(hEl.value) * 3600 + parseInt(mEl.value) * 60 + parseInt(sEl.value)) * 1000;

        if (mainMs <= 0) return alert("有効な時間を設定してください");

        milestones = [];
        if (subSectionsContainer) {
            subSectionsContainer.querySelectorAll('.sub-card').forEach(card => {
                const type = card.querySelector('.sub-type').value;
                const h = parseInt(card.querySelector('.sub-hour').value), m = parseInt(card.querySelector('.sub-min').value), s = parseInt(card.querySelector('.sub-sec').value);
                const name = card.querySelector('.sub-name').value || "お知らせ";
                const seId = card.querySelector('.se-select').value;
                const bgmIds = Array.from(card.querySelectorAll('.bgm-select')).map(s => s.value);
                const bgmLoop = card.querySelector('.sub-bgm-loop')?.checked || false;

                let rem;
                if (type === 'duration') rem = (h * 3600 + m * 60 + s) * 1000;
                else if (type === 'elapsed') rem = mainMs - (h * 3600 + m * 60 + s) * 1000;
                else { const t = new Date(); t.setHours(h, m, s, 0); if (t <= new Date()) t.setDate(t.getDate() + 1); rem = mainMs - (t - new Date()); }
                if (rem > 0 && rem < mainMs) milestones.push({ name, targetRemainingMs: rem, seId, bgmIds, bgmLoop });
            });
        }
        const mainBgmIds = Array.from(document.querySelectorAll('#mainBgmList .bgm-select')).map(s => s.value);
        const mainBgmLoop = document.getElementById('mainBgmLoop')?.checked || false;
        const mainSeRepeat = document.getElementById('mainSeRepeat')?.checked || false;

        milestones.push({
            name: (document.getElementById('mainSectionName')?.value || "終了"),
            targetRemainingMs: 0,
            seId: (document.getElementById('mainSeSelect')?.value || 'default'),
            seRepeat: mainSeRepeat,
            bgmIds: mainBgmIds, // メインのBGMを終了地点のマイルストーンへ
            bgmLoop: mainBgmLoop
        });
        milestones.sort((a, b) => b.targetRemainingMs - a.targetRemainingMs);

        // 開始時のBGM設定: 最初のターゲットに向かうBGMを再生
        const first = milestones[0];
        if (first && first.bgmIds) {
            bgmManager.setPlaylist(first.bgmIds, first.bgmLoop);
            bgmManager.play();
        }

        totalEndTime = new Date(new Date().getTime() + mainMs);
        currentMilestoneIndex = 0; isRunning = true; isPaused = false;
        if (overlay) overlay.style.opacity = '0';
        if (statusLabel) statusLabel.textContent = "Running", statusLabel.classList.remove('text-red-500', 'animate-pulse');
        if (pauseBtn) pauseBtn.classList.remove('hidden'); if (startBtn) startBtn.classList.add('hidden');
        clearInterval(countdownInterval); countdownInterval = setInterval(tick, 100); tick();
    };

    function pauseTimer() {
        if (!isRunning || isPaused) return;
        clearInterval(countdownInterval); isPaused = true;
        bgmManager.stopActive(); // 一時停止時にBGMも止める or resumeで再開させる設計（今回は一旦止める）
        pausedRemainingMs = totalEndTime - new Date();
        if (statusLabel) statusLabel.textContent = "Paused";
        if (pauseBtn) pauseBtn.classList.add('hidden'); if (startBtn) startBtn.classList.remove('hidden');
    }

    async function resumeTimer() {
        if (!isPaused) return;
        await ensureAudioActive();
        totalEndTime = new Date(new Date().getTime() + pausedRemainingMs);
        isPaused = false;
        if (statusLabel) statusLabel.textContent = "Running";
        if (pauseBtn) pauseBtn.classList.remove('hidden'); if (startBtn) startBtn.classList.add('hidden');
        bgmManager.play(); // 再開
        countdownInterval = setInterval(tick, 100);
    }

    function tick() {
        const remTot = totalEndTime - new Date();
        if (remTot <= 0) { finishTimer(); return; }

        while (currentMilestoneIndex < milestones.length - 1 && remTot <= milestones[currentMilestoneIndex].targetRemainingMs) {
            playSE(milestones[currentMilestoneIndex].seId);
            currentMilestoneIndex++; flashDisplay();

            // 新しいマイルストーンのBGMに変更
            const curr = milestones[currentMilestoneIndex];
            if (curr) {
                bgmManager.setPlaylist(curr.bgmIds || [], curr.bgmLoop || false);
                bgmManager.play();
            }
        }

        // フェードアウト更新 (現在のターゲットへの残り1s~0s)
        const currentMilestone = milestones[currentMilestoneIndex];
        if (currentMilestone) {
            const timeToTarget = remTot - currentMilestone.targetRemainingMs;
            bgmManager.updateFade(timeToTarget);
        }
        const curr = milestones[currentMilestoneIndex];
        if (timerDisplay) timerDisplay.textContent = formatTime(remTot - curr.targetRemainingMs);
        if (totalRemainingDisplay) totalRemainingDisplay.textContent = formatTime(remTot);
        const nxt = milestones[currentMilestoneIndex + 1];
        if (nxt) {
            if (nextMilestoneDisplay) nextMilestoneDisplay.textContent = formatTime(remTot - nxt.targetRemainingMs);
            if (nextMilestoneName) nextMilestoneName.textContent = nxt.name;
        } else {
            if (nextMilestoneDisplay) nextMilestoneDisplay.textContent = "--:--:--";
            if (nextMilestoneName) nextMilestoneName.textContent = "最後";
        }
        updateSectionName(curr.name);
    }

    function flashDisplay() {
        if (!mainDisplay) return;
        mainDisplay.classList.add('bg-blue-900/40');
        setTimeout(() => mainDisplay.classList.remove('bg-blue-900/40'), 500);
    }

    function finishTimer() {
        clearInterval(countdownInterval);
        if (timerDisplay) timerDisplay.textContent = "00:00:00";
        if (totalRemainingDisplay) totalRemainingDisplay.textContent = "00:00:00";
        if (statusLabel) statusLabel.textContent = "Time Up!", statusLabel.classList.add('text-red-500', 'animate-pulse');
        if (pauseBtn) pauseBtn.classList.add('hidden'); if (startBtn) startBtn.classList.remove('hidden');
        updateSectionName("終了");
        const final = milestones[milestones.length - 1];
        if (final) {
            if (final.seRepeat && final.seId !== 'off') {
                startRepeatingSe(final.seId);
            } else {
                playSE(final.seId);
            }
        }
    }

    window.resetTimer = function () {
        clearInterval(countdownInterval);
        isRunning = false; isPaused = false;

        // --- 修正：リセット時に通知音とBGMを停止 ---
        stopActiveSe();
        stopRepeatingBuzzer();
        bgmManager.stop();

        if (overlay) overlay.style.opacity = '1';
        if (statusLabel) statusLabel.textContent = "Ready", statusLabel.classList.remove('text-red-500', 'animate-pulse');
        if (pauseBtn) pauseBtn.classList.add('hidden'); if (startBtn) startBtn.classList.remove('hidden');
        if (timerDisplay) timerDisplay.textContent = "00:00:00";
        if (totalRemainingDisplay) totalRemainingDisplay.textContent = "00:00:00";
        if (nextMilestoneDisplay) nextMilestoneDisplay.textContent = "--:--:--";
        if (nextMilestoneName) nextMilestoneName.textContent = "待機中";
        updateSectionName("");
        audioTracks.forEach(t => { t.audio.pause(); t.audio.currentTime = 0; });
        renderAudioTracks();
    };

    function updateSectionName(text) {
        const display = document.getElementById('sectionNameDisplay'), container = document.getElementById('sectionNameContainer');
        if (!display || !container) return;
        display.textContent = text || ""; display.classList.remove('animate-scroll');
        if (text && display.offsetWidth > (container.offsetWidth * 0.95)) {
            display.textContent = `${text}\u3000\u3000${text}\u3000\u3000`;
            display.classList.add('animate-scroll');
        }
    }

    if (startBtn) startBtn.onclick = window.startTimer;
    if (pauseBtn) pauseBtn.onclick = pauseTimer;
    if (resetBtn) resetBtn.onclick = window.resetTimer;

    // --- 全画面表示・ブラウザフルスクリーン制御 ---
    const browserFullBtn = document.getElementById('browserFullBtn');
    const fullscreenBtn = document.getElementById('fullscreenBtn');

    if (browserFullBtn) {
        browserFullBtn.onclick = () => {
            mainDisplay.classList.toggle('is-browser-fullscreen');
            // アイコン等の状態変更が必要ならここに追加
        };
    }

    if (fullscreenBtn) {
        fullscreenBtn.onclick = () => {
            if (!document.fullscreenElement) {
                if (mainDisplay.requestFullscreen) {
                    mainDisplay.requestFullscreen();
                } else if (mainDisplay.webkitRequestFullscreen) {
                    mainDisplay.webkitRequestFullscreen();
                } else if (mainDisplay.msRequestFullscreen) {
                    mainDisplay.msRequestFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                }
            }
        };
    }

    updateAllSeOptions();

    // メインの初期BGMスロットを追加
    window.addBgmSelect('mainBgmList');

    // --- CSV保存・読込の実装 ---
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    if (exportCsvBtn) {
        exportCsvBtn.onclick = () => {
            let csvRows = [];
            csvRows.push("Type,Name,H,M,S,Mode/Type,SE,BGMLoop,BGMIds");

            // メタ情報 (ルートパス)
            const rootPath = document.getElementById('audioRootPath')?.value || "";
            csvRows.push(`META,AudioRootPath,"${rootPath}"`);

            // オーディオ設定 (ファイル名とボリューム)
            audioTracks.forEach(t => {
                csvRows.push(`AUDIO,"${t.name}",${t.volume}`);
            });

            const getTrackName = (id) => {
                if (id === 'off' || id === 'default') return id;
                const t = audioTracks.find(track => track.id === id);
                return t ? t.name : id;
            };

            // メイン設定 (SEとBGMはIDではなく名前で保存)
            const mName = document.getElementById('mainSectionName').value || "";
            const mMode = document.querySelector('input[name="mainTimeMode"]:checked').value;
            const mH = document.getElementById('mainHour').value;
            const mM = document.getElementById('mainMin').value;
            const mS = document.getElementById('mainSec').value;
            const mSe = getTrackName(document.getElementById('mainSeSelect').value);
            const mSeRep = document.getElementById('mainSeRepeat').checked ? "1" : "0";
            const mLoop = document.getElementById('mainBgmLoop').checked ? "1" : "0";
            const mBgms = Array.from(document.querySelectorAll('#mainBgmList .bgm-select')).map(s => getTrackName(s.value)).join('|');
            csvRows.push(`MAIN,"${mName}",${mH},${mM},${mS},${mMode},"${mSe}",${mSeRep},${mLoop},"${mBgms}"`);

            // サブ設定
            document.querySelectorAll('.sub-card').forEach(card => {
                const sName = card.querySelector('.sub-name').value || "";
                const sType = card.querySelector('.sub-type').value;
                const sH = card.querySelector('.sub-hour').value;
                const sM = card.querySelector('.sub-min').value;
                const sS = card.querySelector('.sub-sec').value;
                const sSe = getTrackName(card.querySelector('.se-select').value);
                const sId = card.dataset.id;
                const sLoop = card.querySelector('.sub-bgm-loop').checked ? "1" : "0";
                const sBgms = Array.from(card.querySelectorAll(`#bgmList_${sId} .bgm-select`)).map(s => getTrackName(s.value)).join('|');
                csvRows.push(`SUB,"${sName}",${sH},${sM},${sS},${sType},"${sSe}",${sLoop},"${sBgms}"`);
            });

            const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `timer_config_${new Date().getTime()}.csv`;
            link.click();
        };
    }

    const csvFileInput = document.getElementById('csvFileInput');
    if (csvFileInput) {
        csvFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const text = ev.target.result;
                const rows = text.split(/\r?\n/).slice(1); // ヘッダー飛ばす
                if (confirm("既存の設定を上書きして読み込みますか？")) {
                    applyCsvSettings(rows);
                }
                csvFileInput.value = '';
            };
            reader.readAsText(file);
        };
    }

    async function applyCsvSettings(rows) {
        // 全リセット
        if (subSectionsContainer) subSectionsContainer.innerHTML = '';
        document.getElementById('mainBgmList').innerHTML = '';

        // --- オーディオトラックの管理を改善 ---
        // 既存のオブジェクトURLを解放してメモリリークを防ぐ
        audioTracks.forEach(t => {
            if (t.audio) t.audio.pause();
            URL.revokeObjectURL(t.url);
        });
        audioTracks = [];
        renderAudioTracks();
        updateAllSeOptions();

        let audioRoot = "";
        const audioToLoad = [];
        const dataRows = [];

        // 第1パス: メタ情報とオーディオ情報の抽出
        rows.forEach(line => {
            if (!line || line.startsWith('#')) return;
            const parts = line.match(/(".*?"|[^",\t]+)(?=\s*[,|\t]|$)/g);
            if (!parts) return;
            const clean = parts.map(p => p.replace(/^"|"$/g, ''));
            const type = clean[0];

            if (type === 'META' && clean[1] === 'AudioRootPath') {
                audioRoot = clean[2] || "";
                if (document.getElementById('audioRootPath')) {
                    document.getElementById('audioRootPath').value = audioRoot;
                }
            } else if (type === 'AUDIO') {
                audioToLoad.push({ name: clean[1], volume: parseFloat(clean[2]) || 0.8 });
            } else if (type === 'MAIN' || type === 'SUB') {
                dataRows.push(clean);
            }
        });

        // オーディオの自動読み込み試行
        if (audioToLoad.length > 0) {
            console.log("Attempting to auto-load audio files...");
            const loadPromises = audioToLoad.map(async (info) => {
                // すでに読み込み済みかチェック
                if (audioTracks.some(t => t.name === info.name)) return;

                const url = audioRoot + info.name;
                try {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
                    const blob = await response.blob();
                    const file = new File([blob], info.name, { type: blob.type });

                    const id = 'audio_' + Math.random().toString(36).substr(2, 9);
                    const objectUrl = URL.createObjectURL(file);
                    const audio = new Audio(objectUrl);
                    audio.volume = info.volume;
                    audio.loop = true;
                    audioTracks.push({ id, name: info.name, audio, url: objectUrl, volume: info.volume });
                    console.log(`Auto-loaded: ${info.name}`);
                } catch (e) {
                    console.warn(`Could not auto-load audio: ${info.name}`, e);
                }
            });
            await Promise.all(loadPromises);
            renderAudioTracks();
            updateAllSeOptions();
        }

        const findTrackIdByName = (name) => {
            if (name === 'off' || name === 'default') return name;
            const t = audioTracks.find(track => track.name === name);
            return t ? t.id : null;
        };

        // 第2パス: 設定の適用
        dataRows.forEach(clean => {
            const type = clean[0];
            const name = clean[1];
            const h = clean[2], m = clean[3], s = clean[4];
            const modeOrType = clean[5];
            const seName = clean[6];
            const seRep = clean[7];
            const loop = (type === 'MAIN' ? clean[8] === "1" : clean[7] === "1"); // カラム位置の微調整
            const bgmNames = (type === 'MAIN' ? (clean[9] ? clean[9].split('|') : []) : (clean[8] ? clean[8].split('|') : []));

            if (type === 'MAIN') {
                document.getElementById('mainSectionName').value = name;
                document.getElementById('mainHour').value = h;
                document.getElementById('mainMin').value = m;
                document.getElementById('mainSec').value = s;
                const r = document.querySelector(`input[name="mainTimeMode"][value="${modeOrType}"]`);
                if (r) r.checked = true;

                const seId = findTrackIdByName(seName) || 'default';
                document.getElementById('mainSeSelect').value = seId;
                document.getElementById('mainSeRepeat').checked = (seRep === "1");
                document.getElementById('mainBgmLoop').checked = loop;
                bgmNames.forEach(bn => {
                    const bid = findTrackIdByName(bn) || 'off';
                    window.addBgmSelect('mainBgmList', bid);
                });
            } else if (type === 'SUB') {
                window.createSubSectionCard();
                const cards = subSectionsContainer.querySelectorAll('.sub-card');
                const card = cards[cards.length - 1];
                card.querySelector('.sub-name').value = name;
                card.querySelector('.sub-hour').value = h;
                card.querySelector('.sub-min').value = m;
                card.querySelector('.sub-sec').value = s;
                card.querySelector('.sub-type').value = modeOrType;

                const seId = findTrackIdByName(seName) || 'default';
                card.querySelector('.se-select').value = seId;
                card.querySelector('.sub-bgm-loop').checked = (clean[7] === "1");

                const bgmList = card.querySelector('[id^="bgmList_"]');
                bgmList.innerHTML = '';
                bgmNames.forEach(bn => {
                    const bid = findTrackIdByName(bn) || 'off';
                    window.addBgmSelect(bgmList.id, bid);
                });
                validateSubSection(card);
            }
        });
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSectionTimer);
else initSectionTimer();

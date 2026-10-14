(function () {
    'use strict';
    const game = SmartphoneRush.createGame();
    const s = game.state;
    let canvas = document.getElementById('gameCanvas');
    let renderer = null;
    try { renderer = window.SmartphoneRush3D?.createRenderer(canvas) || null; }
    catch (error) {
        console.warn('3D renderer unavailable. Using 2D.', error);
        const replacement = canvas.cloneNode(true); canvas.replaceWith(replacement); canvas = replacement;
    }
    const ctx = renderer ? null : canvas.getContext('2d');
    const overlayCanvas = document.getElementById('effectCanvas');
    const overlayCtx = renderer ? overlayCanvas.getContext('2d') : null;
    document.getElementById('viewMode').textContent = renderer ? '簡易3D' : '2D表示';
    overlayCanvas.hidden = !renderer;
    const byId = id => document.getElementById(id);
    const keys = new Set();
    const touch = { id: null, x: 0, y: 0, originX: 0, originY: 0 };
    const hints = {
        phone: 'ワザ1：突進してスマホを破壊。破壊ボーナス＋800点。飛んだスマホは人をスピンさせ、ランダムに飛び続ける。',
        flick: 'ワザ2：NPCを10秒間のおはじきに。壁や人で反射し、連鎖を広げる。'
    };
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, previousTime = 0, best = 0, feedbackUntil = 0, lastReport = '', lastSecond = -1, graphicsLost = false;
    try {
        const saved = Number(localStorage.getItem('smartphoneRushBest'));
        if (Number.isSafeInteger(saved) && saved >= 0) best = saved;
    } catch { /* Scores are optional if storage is unavailable. */ }
    byId('bestValue').textContent = best.toLocaleString();

    function rect(x, y, w, h, radius, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y); ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius); ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y); ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
    }
    function circle(x, y, radius, color) {
        ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    }
    function floor() {
        ctx.fillStyle = '#30464f'; ctx.fillRect(0, 0, s.width, s.height);
        ctx.strokeStyle = '#3a5159'; ctx.lineWidth = 1;
        for (let x = 0; x <= s.width; x += 56) { ctx.beginPath(); ctx.moveTo(x, 60); ctx.lineTo(x, s.height); ctx.stroke(); }
        for (let y = 60; y <= s.height; y += 56) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s.width, y); ctx.stroke(); }
        ctx.fillStyle = '#273e47'; ctx.fillRect(0, 0, s.width, 65);
        rect(s.width / 2 - 118, 34, 236, 26, 4, '#152b36');
        ctx.textAlign = 'center'; ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#b5d8d4';
        ctx.fillText('↑ 改札口    GATES    1–4 →', s.width / 2, 52);
        ctx.fillStyle = '#6d7056'; ctx.fillRect(18, 74, 7, s.height - 86); ctx.fillRect(s.width - 25, 74, 7, s.height - 86);
        ctx.fillStyle = '#b7a56b';
        for (let y = 82; y < s.height; y += 14) { ctx.fillRect(19, y, 5, 3); ctx.fillRect(s.width - 24, y, 5, 3); }
        ctx.globalAlpha = .18; ctx.strokeStyle = '#b9d7d0'; ctx.lineWidth = 3;
        for (const [x, y, direction] of [[175, 150, 1], [385, 275, -1], [175, 500, 1]]) {
            ctx.beginPath(); ctx.moveTo(x, y - 16 * direction); ctx.lineTo(x, y + 16 * direction);
            ctx.moveTo(x - 8, y + 7 * direction); ctx.lineTo(x, y + 16 * direction); ctx.lineTo(x + 8, y + 7 * direction); ctx.stroke();
        }
        ctx.globalAlpha = 1;
        for (const pillar of s.pillars) {
            circle(pillar.x + 4, pillar.y + 9, pillar.radius + 3, '#21333ab3');
            rect(pillar.x - 18, pillar.y - 25, 36, 45, 5, '#59717b', '#718b94');
            rect(pillar.x - 14, pillar.y - 21, 28, 12, 3, '#869b9f');
            rect(pillar.x - 11, pillar.y - 4, 22, 15, 2, '#344b54');
            ctx.fillStyle = '#bdd0c9'; ctx.font = 'bold 9px sans-serif'; ctx.fillText('C', pillar.x, pillar.y + 7);
        }
    }
    function drawPerson(npc, player = false) {
        ctx.save(); ctx.translate(npc.x, npc.y);
        const glow = ['#ff6688', '#ffb957', '#ffee66', '#69ef99', '#69dfff', '#a68aff'][Math.floor(s.elapsed * 8 + (npc.id || 0)) % 6];
        if (npc.rampage) { ctx.shadowColor = glow; ctx.shadowBlur = 18; ctx.strokeStyle = glow; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI * 2); ctx.stroke(); }
        const angle = player ? Math.atan2(npc.dy, npc.dx) + Math.PI / 2 : npc.flightTime > 0 ? Math.atan2(npc.vy, npc.vx) + Math.PI / 2 : (npc.direction < 0 ? 0 : Math.PI);
        ctx.translate(0, npc.hop > 0 && !reducedMotion ? -Math.sin(npc.hop / .38 * Math.PI) * 12 : 0);
        ctx.rotate(angle + (reducedMotion ? 0 : npc.spinAngle || 0) + (npc.fall > 0 ? Math.sin(npc.fall * 8) * .9 : 0));
        if (player) {
            ctx.beginPath(); ctx.arc(0, 0, 23, 0, Math.PI * 2); ctx.fillStyle = '#ffc26522'; ctx.fill();
            ctx.strokeStyle = '#ffc265'; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-5, -29); ctx.lineTo(0, -35); ctx.lineTo(5, -29); ctx.stroke();
        }
        ctx.fillStyle = '#101f2666'; ctx.beginPath(); ctx.ellipse(2, 6, 14, 18, 0, 0, Math.PI * 2); ctx.fill();
        if (npc.flightTime > 0) { ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.strokeStyle = '#84e7d7'; ctx.lineWidth = 2; ctx.stroke(); }
        const step = npc.stun > 0 || npc.flightTime > 0 || reducedMotion ? 0 : Math.sin((player ? s.elapsed * 12 : npc.step) || 0) * 3;
        rect(-9, 8 + step, 6, 11, 2, '#172b34'); rect(3, 8 - step, 6, 11, 2, '#172b34');
        rect(-13, -4, 26, 22, 6, npc.rampage ? glow : npc.flash > 0 ? '#ffefd1' : (player ? '#efb459' : npc.color));
        if (player) rect(-7, 1, 14, 13, 3, '#66492d');
        circle(0, -11, 9, player ? '#e8cab1' : '#cebca6');
        ctx.beginPath(); ctx.arc(0, -13, 9, Math.PI, 0); ctx.fillStyle = player ? '#243f48' : '#36404b'; ctx.fill();
        if (!player) {
            if (npc.hasPhone !== false) { rect(-4, -1, 9, 13, 2, '#122631'); rect(-2, 1, 5, 8, 1, '#8ce3d5'); }
            circle(-7, 2, 3, '#cebca6'); circle(8, 2, 3, '#cebca6');
            if (npc.coffee) rect(12, 2, 6, 8, 1, '#f0d5aa');
        }
        ctx.restore();
        if (player) {
            ctx.font = 'bold 9px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe2ae'; ctx.fillText('YOU', npc.x, npc.y - 38);
        }
    }
    function draw() {
        if (renderer) {
            renderer.render(s);
            overlayCtx.clearRect(0, 0, s.width, s.height);
            overlayCtx.textAlign = 'center';
            for (const effect of s.particles) {
                if (effect.type !== 'score') continue;
                const point = renderer.project(effect.x, 72 + (1 - effect.life) * 25, effect.y + 30);
                if (!point) continue;
                overlayCtx.globalAlpha = Math.min(1, effect.life * 2); overlayCtx.font = 'bold 17px ui-monospace, monospace';
                overlayCtx.strokeStyle = '#102731'; overlayCtx.lineWidth = 4;
                overlayCtx.strokeText(effect.text, point.x, point.y); overlayCtx.fillStyle = '#ffe0a1'; overlayCtx.fillText(effect.text, point.x, point.y);
            }
            overlayCtx.globalAlpha = 1;
            const player = renderer.project(s.player.x, 76, s.player.y);
            if (player) {
                overlayCtx.font = 'bold 11px ui-monospace, monospace'; overlayCtx.fillStyle = '#ffe1a5';
                overlayCtx.strokeStyle = '#19323e'; overlayCtx.lineWidth = 3; overlayCtx.strokeText('YOU', player.x, player.y); overlayCtx.fillText('YOU', player.x, player.y);
            }
            if (s.combo > 1) {
                overlayCtx.fillStyle = '#132a35df'; overlayCtx.fillRect(s.width - 160, 55, 145, 29);
                overlayCtx.font = 'bold ' + (12 + (reducedMotion ? 0 : Math.max(0, s.comboTime - 2.05) * 16)) + 'px ui-monospace, monospace'; overlayCtx.fillStyle = '#ffc265';
                overlayCtx.fillText(s.combo + ' COMBO ×' + (1 + Math.min(8, Math.floor(s.combo / 3)) * .25).toFixed(2), s.width - 88, 75);
            }
            return;
        }
        floor();
        const p = s.player, a = s.attack;
        if (a) {
            ctx.save(); ctx.translate(p.x, p.y);
            ctx.fillStyle = '#ffc26526'; ctx.strokeStyle = '#ffc26580'; ctx.lineWidth = 2;
            ctx.beginPath();
            if (a.type === 'spin') ctx.arc(0, 0, a.range, 0, Math.PI * 2);
            else { const angle = Math.atan2(a.dy, a.dx); ctx.moveTo(0, 0); ctx.arc(0, 0, a.range, angle - 1.2, angle + 1.2); ctx.closePath(); }
            ctx.fill(); ctx.stroke(); ctx.restore();
        }
        const all = [...s.people.map(npc => ({ npc, player: false })), { npc: p, player: true }].sort((a, b) => a.npc.y - b.npc.y);
        for (const entry of all) drawPerson(entry.npc, entry.player);
        for (const effect of s.particles) {
            ctx.save(); ctx.globalAlpha = Math.min(1, effect.life * 2);
            if (effect.type === 'score') {
                ctx.textAlign = 'center'; ctx.font = 'bold 19px ui-monospace, monospace'; ctx.strokeStyle = '#112731'; ctx.lineWidth = 4;
                ctx.strokeText(effect.text, effect.x, effect.y); ctx.fillStyle = '#ffda8b'; ctx.fillText(effect.text, effect.x, effect.y);
            } else if (effect.type === 'ring' && !reducedMotion) {
                ctx.beginPath(); ctx.arc(effect.x, effect.y, (1 - effect.life / .35) * 38 + 10, 0, Math.PI * 2); ctx.strokeStyle = '#ffe0a5'; ctx.lineWidth = 2; ctx.stroke();
            } else if (effect.type === 'phone') {
                ctx.translate(effect.x, effect.y); ctx.rotate(effect.age * 7);
                rect(-5, -8, 10, 16, 2, '#102832', '#ffdc96'); rect(-3, -6, 6, 10, 1, '#ff987f');
                ctx.strokeStyle = '#fff2d1'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -5); ctx.lineTo(2, 0); ctx.lineTo(-2, 4); ctx.stroke();
                if (effect.age > .3) { rect(-15, -4, 4, 6, 1, '#8bdacb'); rect(10, 7, 4, 5, 1, '#ffbf7b'); }
            } else if (effect.type === 'coffee') {
                ctx.fillStyle = '#a3886077'; ctx.beginPath(); ctx.ellipse(effect.x, effect.y, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        }
        if (s.combo > 1) {
            rect(s.width - 160, 80, 136, 32, 6, '#132a35db', '#65878c');
            ctx.textAlign = 'center'; ctx.fillStyle = '#ffc265'; ctx.font = 'bold ' + (13 + (reducedMotion ? 0 : Math.max(0, s.comboTime - 2.05) * 16)) + 'px ui-monospace, monospace';
            const multiplier = (1 + Math.min(8, Math.floor(s.combo / 3)) * .25).toFixed(2);
            ctx.fillText(s.combo + ' COMBO  ×' + multiplier, s.width - 92, 101);
        }
    }
    function showFeedback(text) { byId('actionFeedback').textContent = text; feedbackUntil = performance.now() + 1000; }
    function updateHud() {
        byId('scoreValue').textContent = s.score.toLocaleString();
        const second = Math.ceil(s.remaining);
        if (second !== lastSecond) {
            lastSecond = second;
            byId('timeValue').replaceChildren(document.createTextNode(String(second)), Object.assign(document.createElement('small'), { textContent: '秒' }));
        }
        byId('timeValue').parentElement.classList.toggle('urgent', s.remaining <= 10);
        byId('energyBar').value = s.energy; byId('energyValue').textContent = Math.floor(s.energy);
        const comboEl = byId('comboValue');
        if (s.combo > Number(comboEl.textContent) && !reducedMotion) {
            comboEl.getAnimations?.().forEach(animation => animation.cancel());
            comboEl.animate?.([{ transform: 'scale(1.65)', color: '#ffffff', textShadow: '0 0 22px #ffc265' }, { transform: 'scale(1)', color: '#ffc265', textShadow: '0 0 0 transparent' }], { duration: 320, easing: 'ease-out' });
        }
        comboEl.textContent = s.combo;
        byId('multiplierValue').textContent = '×' + (1 + Math.min(8, Math.floor(s.combo / 3)) * .25).toFixed(2);
        byId('hitsValue').textContent = s.hits; byId('damageValue').textContent = s.damage;
        for (const key of ['stagger', 'phone', 'fall', 'chain']) byId(key + 'Value').textContent = s.stats[key];
        byId('bounceValue').textContent = s.stats.bounce;
        byId('flyingValue').textContent = s.people.filter(npc => npc.flightTime > 0).length;
        const activeFlights = s.people.filter(npc => npc.flightTime > 0);
        byId('flightStatus').hidden = !activeFlights.length;
        if (activeFlights.length) byId('flightStatus').textContent = '飛行中 ' + activeFlights.length + '人 / あと' + Math.max(...activeFlights.map(npc => npc.flightTime)).toFixed(1) + '秒';
        byId('attackButton').disabled = s.phase !== 'running' || s.cooldown > 0 || s.energy < SmartphoneRush.MODES.phone.cost;
        byId('flickButton').disabled = s.phase !== 'running' || s.cooldown > 0 || s.energy < SmartphoneRush.MODES.flick.cost;
        const report = s.notices.map(n => n.label + n.points).join('|');
        if (report !== lastReport) {
            lastReport = report; const list = byId('eventList'); list.replaceChildren();
            for (const notice of s.notices) {
                const li = document.createElement('li'); const label = document.createElement('span'); const points = document.createElement('b');
                label.textContent = notice.label; points.textContent = '+' + notice.points; li.append(label, points); list.append(li);
            }
            if (!s.notices.length) { const li = document.createElement('li'); li.className = 'rush-event-empty'; li.textContent = '接触すると、ここに結果が表示されます。'; list.append(li); }
        }
        if (performance.now() > feedbackUntil) byId('actionFeedback').textContent = '';
    }
    function clearInput() {
        keys.clear(); touch.x = 0; touch.y = 0; touch.id = null; byId('stickThumb').style.transform = '';
    }
    function setOverlay(panel) {
        byId('gameOverlay').hidden = !panel;
        for (const id of ['startPanel', 'pausePanel', 'resultPanel']) byId(id).hidden = id !== panel;
        byId('liveControls').hidden = !!panel;
        byId('pauseGame').disabled = s.phase !== 'running';
    }
    function finish() {
        clearInput(); setOverlay('resultPanel');
        byId('resultScore').textContent = s.score.toLocaleString(); byId('resultHits').textContent = s.hits;
        byId('resultDamage').textContent = s.damage; byId('resultCombo').textContent = s.maxCombo;
        let message = s.score > best ? 'NEW RECORD — ベスト更新！' : 'ベスト ' + best.toLocaleString();
        best = Math.max(best, s.score); byId('bestValue').textContent = best.toLocaleString();
        try { localStorage.setItem('smartphoneRushBest', String(best)); } catch { message += '（この環境では記録を保存できません）'; }
        byId('recordNotice').textContent = message;
        byId('playAgain').focus({ preventScroll: true });
    }
    function frame(now) {
        raf = 0;
        if (s.phase !== 'running') return;
        const dt = previousTime ? (now - previousTime) / 1000 : 0; previousTime = now;
        let x = touch.x, y = touch.y;
        if (keys.has('arrowleft') || keys.has('a')) x -= 1;
        if (keys.has('arrowright') || keys.has('d')) x += 1;
        if (keys.has('arrowup') || keys.has('w')) y -= 1;
        if (keys.has('arrowdown') || keys.has('s')) y += 1;
        game.update(dt, { x, y }); draw(); updateHud();
        if (s.phase === 'over') finish();
        else raf = requestAnimationFrame(frame);
    }
    function start() {
        if (graphicsLost) return;
        if (raf) cancelAnimationFrame(raf); clearInput(); game.start(); lastReport = '!';
        setOverlay(null); previousTime = 0; draw(); updateHud(); canvas.focus({ preventScroll: true }); raf = requestAnimationFrame(frame);
    }
    function pause() {
        if (s.phase !== 'running') return;
        game.pause(); if (raf) cancelAnimationFrame(raf); raf = 0; clearInput(); setOverlay('pausePanel');
    }
    function resume() {
        if (graphicsLost) return;
        if (s.phase !== 'paused') return;
        if (byId('menuDrawer')?.hidden === false) return;
        game.resume(); clearInput(); setOverlay(null); previousTime = 0;
        canvas.focus({ preventScroll: true }); raf = requestAnimationFrame(frame);
    }
    function attack(mode = s.mode) {
        select(mode);
        const result = game.attack(mode);
        if (!result.ok && result.reason === 'energy') showFeedback('スタミナ回復を待とう');
        if (!result.ok && result.reason === 'cooldown') showFeedback('ワザ準備中');
        draw(); updateHud();
    }
    function select(mode) {
        game.selectMode(mode);
        for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === s.mode));
        byId('modeHint').textContent = hints[s.mode]; updateHud();
    }
    for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => { if (s.phase === 'running') attack(button.dataset.mode); else select(button.dataset.mode); if (s.phase === 'running') canvas.focus({ preventScroll: true }); });
    byId('startGame').addEventListener('click', start); byId('playAgain').addEventListener('click', start);
    byId('restartPaused').addEventListener('click', start); byId('pauseGame').addEventListener('click', pause);
    byId('resumeGame').addEventListener('click', resume);
    byId('attackButton').addEventListener('click', () => attack('phone')); byId('flickButton').addEventListener('click', () => attack('flick'));
    document.addEventListener('keydown', event => {
        if (byId('menuDrawer')?.hidden === false) return;
        if (event.target.matches?.('input, textarea, select') || event.target.isContentEditable) return;
        const key = event.key.toLowerCase();
        if (['q', 'e'].includes(key) && !event.repeat) { s.phase === 'running' ? attack(key === 'q' ? 'phone' : 'flick') : select(key === 'q' ? 'phone' : 'flick'); return; }
        if (key === 'p' && !event.repeat) { s.phase === 'running' ? pause() : resume(); return; }
        if (s.phase !== 'running') return;
        if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(key)) { event.preventDefault(); keys.add(key); }
        if (event.code === 'Space' && !event.target.closest?.('button')) { event.preventDefault(); if (!event.repeat) attack(); }
    });
    document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('blur', pause);
    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); graphicsLost = true; pause(); setOverlay('pausePanel'); byId('viewMode').textContent = '3D描画が停止しました';
        byId('pausePanel').querySelector('p:not(.rush-kicker)').textContent = 'ページを再読み込みして再開してください。';
        byId('resumeGame').disabled = true; byId('restartPaused').disabled = true;
    });
    // Opening the common navigation also freezes the round.
    document.addEventListener('click', event => { if (event.target.closest?.('#menuBtn')) pause(); });
    function pointerStart(event) {
        if (s.phase !== 'running' || touch.id !== null || event.button > 0) return;
        event.preventDefault(); touch.id = event.pointerId; touch.originX = event.clientX; touch.originY = event.clientY;
        touch.x = 0; touch.y = 0; event.currentTarget.setPointerCapture(event.pointerId);
    }
    function pointerMove(event) {
        if (event.pointerId !== touch.id) return;
        const dx = event.clientX - touch.originX, dy = event.clientY - touch.originY, distance = Math.hypot(dx, dy);
        const amount = Math.min(1, distance / 32);
        touch.x = distance > 3 ? dx / distance * amount : 0; touch.y = distance > 3 ? dy / distance * amount : 0;
        byId('stickThumb').style.transform = `translate(${touch.x * 22}px, ${touch.y * 22}px)`;
    }
    function pointerEnd(event) {
        if (event.pointerId !== touch.id) return;
        touch.id = null; touch.x = 0; touch.y = 0; byId('stickThumb').style.transform = '';
    }
    for (const target of [canvas, byId('moveStick')]) {
        target.addEventListener('pointerdown', pointerStart); target.addEventListener('pointermove', pointerMove);
        target.addEventListener('pointerup', pointerEnd); target.addEventListener('pointercancel', pointerEnd);
        target.addEventListener('lostpointercapture', pointerEnd);
    }
    draw(); updateHud();
})();

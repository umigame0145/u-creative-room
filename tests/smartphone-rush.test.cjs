const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGame, MODES, RULES } = require('../u-t-on/games/smartphone-rush-engine.js');
const { JSDOM } = require('jsdom');
const fs = require('node:fs');
function fixture() { const game = createGame({ random: () => .4 }); game.start(); game.state.people = []; return game; }
function commuter(game, x = game.state.player.x, y = game.state.player.y - 29, id = 1) {
    const npc = { id, radius: 14, x, y, vx: 0, vy: 0, direction: 1, speed: 0, color: '#aaaaaa', coffee: false, hasPhone: true,
        stun: 0, fall: 0, flash: 0, step: 0, flightUntil: 0, flightTime: 0 };
    game.state.people.push(npc); return npc;
}
function tick(game, seconds, input) { for (let i = 0; i < Math.round(seconds * 100); i++) game.update(.01, input); }
test('Ordinary body contact bounces the NPC, separates bodies and awards points without a skill', () => {
    const game = fixture(), p = game.state.player, npc = commuter(game); npc.speed = 40;
    game.update(.04);
    assert.equal(game.state.score, RULES.contactPoints); assert.ok(npc.vy < 0);
    assert.ok(Math.hypot(npc.x - p.x, npc.y - p.y) >= p.radius + npc.radius - .01);
    assert.equal(game.state.energy, 100); assert.equal(game.state.stats.phone, 0);
});
test('A skill only scores on actual body contact, not on distant NPCs', () => {
    const game = fixture(); commuter(game, game.state.player.x, game.state.player.y - 100);
    game.attack('phone'); assert.equal(game.state.score, 0);
    game.update(.01); assert.equal(game.state.score, 0);
});
test('Phone rush destroys a phone for a high bonus and a broken phone cannot score twice', () => {
    const game = fixture(), npc = commuter(game);
    game.attack('phone'); game.update(.01);
    assert.equal(game.state.score, MODES.phone.points + RULES.phoneBonus); assert.equal(npc.hasPhone, false);
    assert.equal(game.state.stats.phone, 1); assert.ok(game.state.particles.some(p => p.type === 'phone' && p.broken));
    game.state.cooldown = 0; game.state.energy = 100; game.state.combo = 0;
    Object.assign(npc, { x: game.state.player.x, y: game.state.player.y - 27, vx: 0, vy: 0, stun: 0 });
    const score = game.state.score; game.attack('phone');
    assert.equal(game.state.score - score, MODES.phone.points); assert.equal(game.state.stats.phone, 1);
});
test('Flick launches in the collision direction at constant speed for ten seconds', () => {
    const game = fixture(), npc = commuter(game); game.attack('flick'); game.update(.01);
    assert.equal(game.state.score, MODES.flick.points); assert.equal(npc.flightTime, 10); assert.ok(npc.vy < 0);
    tick(game, 2); assert.ok(Math.abs(Math.hypot(npc.vx, npc.vy) - RULES.flightSpeed) < .001);
    assert.ok(Math.abs(npc.flightTime - 8) < .001);
    tick(game, 8.02); assert.equal(npc.flightTime, 0);
});
test('Flying NPC reflects from a wall without losing speed or farming wall points', () => {
    const game = fixture(), npc = commuter(game, game.state.width - 23, 290);
    Object.assign(npc, { vx: 310, vy: 0, flightUntil: 10, flightTime: 10 });
    game.update(.02); assert.ok(npc.vx < 0); assert.equal(Math.hypot(npc.vx, npc.vy), 310);
    assert.ok(game.state.stats.bounce > 0); assert.equal(game.state.score, 0);
});
test('Flying NPC reflects off a pillar and remains outside its collider', () => {
    const game = fixture(), pillar = game.state.pillars[0], npc = commuter(game, pillar.x - 37, pillar.y);
    Object.assign(npc, { vx: 310, vy: 0, flightUntil: 10, flightTime: 10 });
    game.update(.02); assert.ok(npc.vx < 0);
    assert.ok(Math.hypot(npc.x - pillar.x, npc.y - pillar.y) >= pillar.radius + npc.radius);
});
test('Flick reflects on NPC contact and propagates through multiple NPCs with the original deadline', () => {
    const game = fixture(), p = game.state.player;
    const first = commuter(game), second = commuter(game, p.x, first.y - 70, 2), third = commuter(game, p.x, first.y - 140, 3);
    game.attack('flick'); game.update(.01); const deadline = first.flightUntil;
    tick(game, .5);
    assert.ok(game.state.stats.chain >= 2); assert.equal(second.flightUntil, deadline); assert.equal(third.flightUntil, deadline);
    assert.ok(game.state.score > MODES.flick.points + RULES.chainPoints);
    tick(game, 10); assert.equal(game.state.people.filter(n => n.flightTime > 0).length, 0);
});
test('Flying NPC cannot tunnel through the player and reflects on contact', () => {
    const game = fixture(), p = game.state.player, npc = commuter(game, p.x - 70, p.y);
    Object.assign(npc, { vx: 310, vy: 0, flightUntil: 10, flightTime: 10 });
    tick(game, .3); assert.ok(npc.vx < 0);
    assert.ok(Math.hypot(npc.x - p.x, npc.y - p.y) >= 28 - .01);
});
test('Cooldown, stamina and contact debounce block duplicate scores but not collision resolution', () => {
    const game = fixture(), npc = commuter(game); game.attack('flick'); game.update(.01);
    assert.equal(game.attack().reason, 'cooldown');
    game.state.cooldown = 0; game.state.energy = 1; assert.equal(game.attack('phone').reason, 'energy');
    const score = game.state.score;
    Object.assign(npc, { x: game.state.player.x, y: game.state.player.y - 26, vx: 0, vy: 310 });
    game.state.attack = null; game.update(.01); assert.equal(game.state.score, score);
    assert.ok(npc.vy < 0); assert.ok(Math.hypot(npc.x - game.state.player.x, npc.y - game.state.player.y) >= 28 - .01);
});
test('Initial crowds do not overlap and walking NPCs do not pass through each other', () => {
    const game = createGame({ random: () => .4 }); game.start();
    for (let i = 0; i < game.state.people.length; i++) for (let j = i + 1; j < game.state.people.length; j++) {
        const a = game.state.people[i], b = game.state.people[j]; assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 28);
    }
    game.state.people = []; const a = commuter(game, 200, 300, 1), b = commuter(game, 200, 330, 2);
    a.speed = b.speed = 30; b.direction = -1; tick(game, .2);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 28 - .01); assert.equal(game.state.score, 0);
});
test('Diagonal movement is normalized and the player stays inside the concourse', () => {
    const a = fixture(), b = fixture(); tick(a, .2, { x: 1, y: 0 }); tick(b, .2, { x: 1, y: 1 });
    const origin = { x: a.state.width / 2, y: a.state.height * .73 };
    assert.ok(Math.abs(Math.hypot(a.state.player.x - origin.x, a.state.player.y - origin.y) - Math.hypot(b.state.player.x - origin.x, b.state.player.y - origin.y)) < .001);
    tick(a, 8, { x: 1, y: -1 }); assert.ok(a.state.player.x <= a.state.width - 22); assert.ok(a.state.player.y >= 78);
});
test('Contact combo multiplies destruction points and expires after inactivity', () => {
    const game = fixture();
    for (let i = 0; i < 4; i++) {
        game.state.people = []; commuter(game, game.state.player.x, game.state.player.y - 27, i);
        game.state.cooldown = 0; game.state.energy = 100; game.attack('phone');
    }
    assert.equal(game.state.combo, 4); assert.equal(game.state.maxCombo, 4);
    assert.equal(game.state.score, 940 + 940 + 1175 + 1175);
    tick(game, 2.5); assert.equal(game.state.combo, 0); assert.equal(game.state.maxCombo, 4);
});
test('Pause freezes flight timers, time-up ends the round, and replay restores phones and stats', () => {
    const game = fixture(), npc = commuter(game); game.attack('flick'); game.update(.01); game.pause();
    const remaining = game.state.remaining, flight = npc.flightTime; tick(game, 1);
    assert.equal(game.state.remaining, remaining); assert.equal(npc.flightTime, flight); assert.equal(game.attack().ok, false);
    game.resume(); game.state.remaining = .02; tick(game, .03); assert.equal(game.state.phase, 'over');
    game.start(); assert.equal(game.state.score, 0); assert.equal(game.state.damage, 0); assert.equal(game.state.energy, 100);
    assert.equal(game.state.people.length, 25); assert.ok(game.state.people.every(n => n.hasPhone && !n.flightTime));
});
test('Slow frames count real elapsed time without teleporting and do not extend flight', () => {
    const game = fixture(), npc = commuter(game); game.attack('flick'); game.update(.01);
    game.state.attack = null; const x = game.state.player.x;
    game.update(2, { x: 1, y: 0 }); assert.ok(game.state.player.x - x < 10); assert.ok(Math.abs(npc.flightTime - 8) < .001);
    game.update(10); assert.equal(npc.flightTime, 0); game.update(60); assert.equal(game.state.phase, 'over');
});
test('Game page uses two direct skill buttons, body-contact scoring, menu pause and keyboard resume', () => {
    const dom = new JSDOM(fs.readFileSync('u-t-on/games/smartphone-rush.html', 'utf8'), { url: 'https://u-t-on.com/games/smartphone-rush.html', runScripts: 'outside-only' });
    try {
        const w = dom.window; let frame;
        w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
        w.requestAnimationFrame = fn => { frame = fn; return 1; }; w.cancelAnimationFrame = () => {};
        w.matchMedia = () => ({ matches: false });
        for (const path of ['games/smartphone-rush-engine.js', 'games/smartphone-rush.js', 'common/site-data.js', 'common/site-manager.js']) w.eval(fs.readFileSync('u-t-on/' + path, 'utf8'));
        w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
        const d = w.document;
        assert.equal(d.querySelector('.site-brand').getAttribute('href'), '../index.html'); assert.equal(d.querySelectorAll('[data-mode]').length, 2);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'E', bubbles: true }));
        assert.equal(d.querySelector('[data-mode="flick"]').getAttribute('aria-pressed'), 'true');
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'q', bubbles: true }));
        assert.equal(d.querySelector('[data-mode="phone"]').getAttribute('aria-pressed'), 'true');
        d.getElementById('startGame').click(); assert.equal(d.getElementById('gameOverlay').hidden, true);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Q', bubbles: true })); frame(100); frame(150); frame(190);
        assert.ok(Number(d.getElementById('scoreValue').textContent.replace(/,/g, '')) > 0);
        assert.ok(Number(d.getElementById('phoneValue').textContent) > 0);
        d.getElementById('menuBtn').click(); assert.equal(d.getElementById('pausePanel').hidden, false);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'p', bubbles: true })); assert.equal(d.getElementById('pausePanel').hidden, false);
        d.getElementById('closeBtn').click(); d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'p', bubbles: true })); assert.equal(d.getElementById('gameOverlay').hidden, true);
    } finally { dom.window.close(); }
});
test('Pointer release stops movement, blur pauses, and results/replay work without storage', () => {
    const dom = new JSDOM(fs.readFileSync('u-t-on/games/smartphone-rush.html', 'utf8'), { url: 'http://localhost/games/smartphone-rush.html', runScripts: 'outside-only' });
    try {
        const w = dom.window; let frame, game;
        w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {}, set: () => true });
        w.HTMLElement.prototype.setPointerCapture = () => {};
        w.requestAnimationFrame = fn => { frame = fn; return 1; }; w.cancelAnimationFrame = () => {};
        Object.defineProperty(w, 'localStorage', { get() { throw new Error('storage blocked'); } });
        w.eval(fs.readFileSync('u-t-on/games/smartphone-rush-engine.js', 'utf8'));
        const create = w.SmartphoneRush.createGame; w.SmartphoneRush.createGame = () => { game = create(); return game; };
        w.eval(fs.readFileSync('u-t-on/games/smartphone-rush.js', 'utf8'));
        const d = w.document; d.getElementById('startGame').click(); frame(100); game.state.people = [];
        const stick = d.getElementById('moveStick');
        function pointer(type, x, y) {
            const event = new w.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
            Object.defineProperty(event, 'pointerId', { value: 1 }); stick.dispatchEvent(event);
        }
        const x = game.state.player.x; pointer('pointerdown', 50, 50); pointer('pointermove', 82, 50); frame(120);
        assert.ok(game.state.player.x > x); pointer('pointerup', 82, 50);
        const stoppedX = game.state.player.x; frame(140); assert.equal(game.state.player.x, stoppedX);
        w.dispatchEvent(new w.Event('blur')); const remaining = game.state.remaining; frame(160); assert.equal(game.state.remaining, remaining);
        d.getElementById('resumeGame').click(); game.state.remaining = .01; frame(180); frame(200); assert.equal(d.getElementById('resultPanel').hidden, false);
        assert.match(d.getElementById('recordNotice').textContent, /保存できません/);
        d.getElementById('playAgain').click(); assert.equal(game.state.phase, 'running'); assert.equal(game.state.remaining, 60);
    } finally { dom.window.close(); }
});

test('Body contact has a short hop that settles after the bounce', () => {
    const game = fixture(), npc = commuter(game); npc.speed = 40;
    game.update(.04); assert.ok(npc.hop > 0); assert.ok(Math.hypot(npc.vx, npc.vy) > 180);
    tick(game, .5); assert.equal(npc.hop, 0);
});
test('Airborne phone spins a person, redirects randomly and can hit another person', () => {
    const game = fixture(), p = game.state.player;
    const first = commuter(game, p.x, p.y - 28), second = commuter(game, p.x, p.y - 85, 2);
    game.attack('phone'); game.state.attack = null;
    const phone = game.state.particles.find(e => e.type === 'phone');
    for (let i = 0; i < 60 && !second.spin; i++) game.update(.01);
    assert.ok(second.spin > 0); assert.equal(phone.lastTarget, second);
    assert.ok(Math.abs(Math.hypot(phone.vx, phone.vy) - 260) < .001);
    assert.ok(phone.vx < 0 && phone.vy > 0);
    const third = commuter(game, phone.x + phone.vx * .1, phone.y + phone.vy * .1, 3);
    for (let i = 0; i < 30 && !third.spin; i++) game.update(.01);
    assert.ok(third.spin > 0); game.update(.01); assert.ok(third.spinAngle > 0);
    const x = phone.x, spin = third.spin; game.pause(); game.update(1);
    assert.equal(phone.x, x); assert.equal(third.spin, spin);
    game.resume(); tick(game, 1); assert.equal(third.spin, 0);
    tick(game, 8); assert.ok(!game.state.particles.includes(phone));
    game.start(); assert.equal(game.state.player.spin, 0); assert.equal(game.state.particles.length, 0);
});

test('Both distinct skills activate rainbow rampage in either order and double target points', () => {
    for (const order of [['phone', 'flick'], ['flick', 'phone']]) {
        const game = fixture(), p = game.state.player, npc = commuter(game, p.x, p.y - 27);
        game.attack(order[0]); assert.ok(!npc.rampage);
        game.state.attack = null; game.state.cooldown = 0; game.state.energy = 100;
        Object.assign(npc, { x: p.x, y: p.y - 27, vx: 0, vy: 0 });
        const before = game.state.score;
        game.attack(order[1]);
        assert.equal(npc.rampage, true); assert.equal(npc.skillHits, 3);
        const base = MODES[order[1]].points + (order[1] === 'phone' ? RULES.phoneBonus : 0);
        assert.equal(game.state.score - before, base * 2);
        assert.equal(npc.flightUntil, game.state.duration);
        game.state.attack = null; tick(game, .2);
        assert.ok(npc.spinAngle > 0); assert.ok(npc.hop > 0);
        game.pause(); const angle = npc.spinAngle; game.update(1); assert.equal(npc.spinAngle, angle);
        game.start(); assert.ok(game.state.people.every(n => !n.rampage && !n.skillHits));
    }
});
test('Repeating only one skill does not activate rainbow rampage', () => {
    const game = fixture(), p = game.state.player, npc = commuter(game, p.x, p.y - 27);
    for (let i = 0; i < 2; i++) {
        game.state.cooldown = 0; game.state.energy = 100;
        Object.assign(npc, { x: p.x, y: p.y - 27 }); game.attack('phone');
    }
    assert.ok(!npc.rampage); assert.equal(npc.skillHits, 1);
});

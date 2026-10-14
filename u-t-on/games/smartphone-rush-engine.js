(function (root) {
    'use strict';
    const MODES = Object.freeze({
        phone: { name: 'スマホ飛ばし', cost: 28, cooldown: .9, speed: 500, points: 140, damage: 1, duration: .32, range: 30 },
        flick: { name: 'おはじきアタック', cost: 35, cooldown: 1.2, speed: 330, points: 200, damage: 2, duration: .24, range: 30 }
    });
    const RULES = Object.freeze({ contactPoints: 50, phoneBonus: 800, chainPoints: 150, flightSeconds: 10, flightSpeed: 310 });
    const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
    function createGame(options = {}) {
        const random = options.random || Math.random;
        const width = options.width || 560, height = options.height || 620, duration = options.duration || 60;
        const contacts = new Map();
        const state = {
            phase: 'ready', width, height, duration, remaining: duration, elapsed: 0, mode: 'phone',
            score: 0, damage: 0, hits: 0, combo: 0, maxCombo: 0, comboTime: 0, energy: 100, cooldown: 0, attack: null, serial: 0,
            player: { x: width / 2, y: height * .73, dx: 0, dy: -1, radius: 14, vx: 0, vy: 0 },
            people: [], particles: [], notices: [],
            stats: { stagger: 0, phone: 0, fall: 0, chain: 0, bounce: 0 },
            pillars: [{ x: 86, y: 226, radius: 22 }, { x: width - 86, y: 390, radius: 22 }]
        };
        function person(id) {
            return { id, radius: 14, x: 0, y: 0, vx: 0, vy: 0, direction: random() > .5 ? 1 : -1, speed: 20 + random() * 23,
                color: ['#8aafae', '#cda985', '#a9a1b6', '#c3cecd', '#e1c78b'][Math.floor(random() * 5)],
                coffee: random() > .7, hasPhone: true, stun: 0, fall: 0, flash: 0, step: random() * 6,
                flightUntil: 0, flightTime: 0 };
        }
        function free(x, y) {
            return Math.hypot(x - state.player.x, y - state.player.y) >= 34 &&
                state.people.every(n => Math.hypot(x - n.x, y - n.y) >= 34) &&
                state.pillars.every(p => Math.hypot(x - p.x, y - p.y) >= p.radius + 20);
        }
        function populate() {
            state.people = [];
            for (let i = 0; i < 25; i++) {
                const npc = person(i);
                if (!i) Object.assign(npc, { x: state.player.x, y: state.player.y - 52, direction: 1 });
                else {
                    let placed = false;
                    for (let attempt = 0; attempt < 40; attempt++) {
                        const x = 40 + random() * (width - 80), y = 92 + random() * (height - 136);
                        if (free(x, y)) { Object.assign(npc, { x, y }); placed = true; break; }
                    }
                    if (!placed) {
                        for (let y = 100; y < height - 40 && !placed; y += 40) for (let x = 42; x < width - 30; x += 40) {
                            if (free(x, y)) { Object.assign(npc, { x, y }); placed = true; break; }
                        }
                    }
                }
                state.people.push(npc);
            }
        }
        populate();
        function start() {
            Object.assign(state, { phase: 'running', remaining: duration, elapsed: 0, score: 0, damage: 0, hits: 0,
                combo: 0, maxCombo: 0, comboTime: 0, energy: 100, cooldown: 0, attack: null, serial: 0,
                stats: { stagger: 0, phone: 0, fall: 0, chain: 0, bounce: 0 }, particles: [], notices: [] });
            Object.assign(state.player, { x: width / 2, y: height * .73, dx: 0, dy: -1, vx: 0, vy: 0, spin: 0, spinAngle: 0, hop: 0 });
            contacts.clear(); populate();
        }
        function selectMode(mode) { if (Object.hasOwn(MODES, mode)) state.mode = mode; }
        function pause() { if (state.phase === 'running') state.phase = 'paused'; }
        function resume() { if (state.phase === 'paused') state.phase = 'running'; }
        function flying(npc) { return npc.flightUntil > state.elapsed; }
        function award(npc, points, damage, label, chain = false) {
            state.hits++; state.damage += damage; state.combo++; state.maxCombo = Math.max(state.combo, state.maxCombo); state.comboTime = 2.4;
            state.stats.stagger++; if (chain) state.stats.chain++;
            points = Math.round(points * (npc.rampage ? 2 : 1) * (1 + Math.min(8, Math.floor(state.combo / 3)) * .25)); state.score += points;
            state.particles.push({ type: 'score', text: '+' + points, x: npc.x, y: npc.y - 30, vx: 0, vy: -26, life: 1, age: 0 });
            state.particles.push({ type: 'ring', x: npc.x, y: npc.y, vx: 0, vy: 0, life: .35, age: 0 });
            state.notices.unshift({ label, points, chain, life: 3 }); state.notices.length = Math.min(4, state.notices.length);
            npc.flash = .2;
        }
        function launch(npc, nx, ny, deadline) {
            if (!flying(npc)) state.stats.fall++;
            npc.flightUntil = deadline; npc.flightTime = Math.max(0, deadline - state.elapsed);
            npc.vx = nx * RULES.flightSpeed; npc.vy = ny * RULES.flightSpeed; npc.stun = 0; npc.fall = .2;
        }
        function ready(key, delay) {
            if ((contacts.get(key) ?? -Infinity) + delay > state.elapsed) return false;
            contacts.set(key, state.elapsed); return true;
        }
        function normal(npc, nx, ny, speed = 225) {
            if (flying(npc)) {
                const dot = npc.vx * nx + npc.vy * ny;
                if (dot < 0) { npc.vx -= 2 * dot * nx; npc.vy -= 2 * dot * ny; }
            } else { npc.vx = nx * speed; npc.vy = ny * speed; npc.stun = .55; npc.hop = .38; }
        }
        function contact(npc, nx, ny, key) {
            const a = state.attack;
            const skill = a && !a.touched.has(npc.id);
            if (skill) {
                a.touched.add(npc.id); contacts.set(key, state.elapsed);
                npc.skillHits = (npc.skillHits || 0) | (a.type === 'phone' ? 1 : 2);
                const enraged = npc.skillHits === 3 && !npc.rampage;
                if (enraged) npc.rampage = true;
                if (a.type === 'flick') {
                    launch(npc, nx, ny, state.elapsed + RULES.flightSeconds);
                    award(npc, a.points, a.damage, 'おはじき発射');
                } else {
                    let points = a.points, damage = a.damage, label = '突進接触';
                    if (npc.hasPhone !== false) {
                        npc.hasPhone = false; state.stats.phone++; points += RULES.phoneBonus; damage += 3; label = 'スマホ破壊';
                        state.particles.push({ type: 'phone', x: npc.x, y: npc.y, vx: nx * 200, vy: ny * 200, life: 8, age: 0, broken: true, radius: 5, lastTarget: npc, hitCooldown: .12 });
                    }
                    normal(npc, nx, ny, 210); award(npc, points, damage, label);
                }
                if (npc.rampage) launch(npc, nx, ny, state.elapsed + state.remaining);
                if (enraged) state.notices.unshift({ label: '虹色暴走！ 得点×2', points: 0, life: 3 });
            } else {
                normal(npc, nx, ny);
                if (ready(key, .45)) award(npc, RULES.contactPoints, 1, '体当たり');
            }
        }
        function attack(mode) {
            if (mode) selectMode(mode);
            if (state.phase !== 'running') return { ok: false, reason: 'stopped' };
            const move = MODES[state.mode];
            if (state.cooldown > 0) return { ok: false, reason: 'cooldown' };
            if (state.energy < move.cost) return { ok: false, reason: 'energy' };
            state.energy -= move.cost; state.cooldown = move.cooldown;
            state.attack = { ...move, type: state.mode, life: move.duration, id: ++state.serial, touched: new Set(), dx: state.player.dx, dy: state.player.dy };
            resolveBodies(true);
            return { ok: true };
        }
        function boundary(entity, reflect) {
            let bounced = false;
            for (const [axis, lo, hi, velocity] of [['x', 22, width - 22, 'vx'], ['y', 78, height - 28, 'vy']]) {
                if (entity[axis] < lo) { entity[axis] = lo; if (reflect && entity[velocity] < 0) { entity[velocity] *= -1; bounced = true; } }
                if (entity[axis] > hi) { entity[axis] = hi; if (reflect && entity[velocity] > 0) { entity[velocity] *= -1; bounced = true; } }
            }
            for (const pillar of state.pillars) {
                let dx = entity.x - pillar.x, dy = entity.y - pillar.y, distance = Math.hypot(dx, dy);
                const radius = pillar.radius + (entity.radius || 14);
                if (distance < radius) {
                    const nx = distance ? dx / distance : 1, ny = distance ? dy / distance : 0;
                    entity.x = pillar.x + nx * (radius + .01); entity.y = pillar.y + ny * (radius + .01);
                    const dot = entity.vx * nx + entity.vy * ny;
                    if (reflect && dot < 0) { entity.vx -= 2 * dot * nx; entity.vy -= 2 * dot * ny; bounced = true; }
                }
            }
            if (bounced && flying(entity)) state.stats.bounce++;
        }
        function resolveBodies(impulses) {
            let overlaps = 0;
            const p = state.player;
            for (const npc of state.people) {
                const dx = npc.x - p.x, dy = npc.y - p.y, d = Math.hypot(dx, dy), radius = (npc.radius || 14) + p.radius;
                if (d > radius + .01) continue;
                const nx = d ? dx / d : p.dx, ny = d ? dy / d : p.dy;
                const depth = Math.max(0, radius - d) + .02;
                p.x -= nx * depth * .65; p.y -= ny * depth * .65; npc.x += nx * depth * .35; npc.y += ny * depth * .35; overlaps++;
                const closing = (npc.vx - p.vx) * nx + (npc.vy - p.vy) * ny;
                if (impulses && (closing < -.1 || state.attack && !state.attack.touched.has(npc.id))) contact(npc, nx, ny, 'p:' + npc.id);
            }
            for (let i = 0; i < state.people.length; i++) for (let j = i + 1; j < state.people.length; j++) {
                const a = state.people[i], b = state.people[j];
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), radius = (a.radius || 14) + (b.radius || 14);
                if (d > radius + .01) continue;
                const angle = (i * 13 + j * 7) % 6.28;
                const nx = d ? dx / d : Math.cos(angle), ny = d ? dy / d : Math.sin(angle), depth = Math.max(0, radius - d) + .02;
                a.x -= nx * depth / 2; a.y -= ny * depth / 2; b.x += nx * depth / 2; b.y += ny * depth / 2; overlaps++;
                if (!impulses) continue;
                const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (closing >= -.1) continue;
                const af = flying(a), bf = flying(b);
                if (af || bf) {
                    const source = af ? a : b, target = af ? b : a, direction = af ? 1 : -1;
                    const deadline = source.flightUntil;
                    for (const [npc, sign] of [[a, 1], [b, -1]]) {
                        if (!flying(npc)) continue;
                        const dot = npc.vx * nx + npc.vy * ny;
                        if (dot * sign > 0) { npc.vx -= 2 * dot * nx; npc.vy -= 2 * dot * ny; }
                    }
                    if (!flying(target)) launch(target, nx * direction, ny * direction, deadline);
                    if (ready('n:' + a.id + ':' + b.id, .3)) award(target, RULES.chainPoints, 1, 'おはじき連鎖', true);
                } else {
                    const av = a.vx * nx + a.vy * ny, bv = b.vx * nx + b.vy * ny;
                    a.vx += (bv - av) * nx; a.vy += (bv - av) * ny; b.vx += (av - bv) * nx; b.vy += (av - bv) * ny;
                    a.stun = b.stun = .16;
                    if (Math.abs(ny) > .5) { a.direction *= -1; b.direction *= -1; }
                }
            }
            boundary(p, false); for (const npc of state.people) boundary(npc, true);
            return overlaps;
        }
        function updatePhones(step) {
            for (const phone of state.particles) {
                if (phone.type !== 'phone' || phone.life <= 0) continue;
                phone.x += phone.vx * step; phone.y += phone.vy * step;
                phone.hitCooldown = Math.max(0, (phone.hitCooldown || 0) - step);
                boundary(phone, true);
                if (phone.lastTarget && !phone.hitCooldown && Math.hypot(phone.x - phone.lastTarget.x, phone.y - phone.lastTarget.y) > phone.lastTarget.radius + phone.radius + 2) phone.lastTarget = null;
                for (const target of [...state.people, state.player]) {
                    if (target === phone.lastTarget) continue;
                    if (Math.hypot(phone.x - target.x, phone.y - target.y) > (target.radius || 14) + phone.radius) continue;
                    target.spin = .8; target.spinAngle = target.spinAngle || 0; target.flash = .2;
                    if (target !== state.player) target.stun = Math.max(target.stun, .8);
                    const angle = random() * Math.PI * 2;
                    phone.vx = Math.cos(angle) * 260; phone.vy = Math.sin(angle) * 260;
                    phone.x = target.x + Math.cos(angle) * (target.radius + phone.radius + 1);
                    phone.y = target.y + Math.sin(angle) * (target.radius + phone.radius + 1);
                    phone.lastTarget = target; phone.hitCooldown = .15; phone.age = 0;
                    break;
                }
            }
        }
        function update(dt, input = { x: 0, y: 0 }) {
            if (state.phase !== 'running' || !Number.isFinite(dt) || dt <= 0) return;
            const elapsed = dt;
            state.remaining = Math.max(0, state.remaining - elapsed); state.elapsed += elapsed;
            if (!state.remaining) { state.phase = 'over'; state.attack = null; return; }
            state.energy = Math.min(100, state.energy + elapsed * 19); state.cooldown = Math.max(0, state.cooldown - elapsed);
            state.comboTime = Math.max(0, state.comboTime - elapsed); if (!state.comboTime) state.combo = 0;
            for (const entity of [...state.people, state.player]) {
                entity.hop = Math.max(0, (entity.hop || 0) - elapsed);
                if (entity.spin > 0) entity.spinAngle = (entity.spinAngle || 0) + Math.min(elapsed, entity.spin) * Math.PI * 10;
                entity.spin = Math.max(0, (entity.spin || 0) - elapsed);
                if (!entity.spin) entity.spinAngle = 0;
            }
            for (const npc of state.people) {
                const wasFlying = npc.flightTime > 0;
                npc.flightTime = Math.max(0, (npc.flightUntil || 0) - state.elapsed);
                if (wasFlying && !npc.flightTime) { npc.vx = npc.vy = 0; npc.stun = .3; }
                if (npc.rampage) { npc.spinAngle = state.elapsed * 12; npc.hop = .19 + Math.sin(state.elapsed * 14) * .12; }
                npc.flash = Math.max(0, npc.flash - elapsed); npc.fall = Math.max(0, npc.fall - elapsed); npc.step += elapsed * 6;
            }
            const simulated = Math.min(elapsed, .05), count = Math.max(1, Math.ceil(simulated / (1 / 120))), step = simulated / count;
            const length = Math.hypot(input.x || 0, input.y || 0), p = state.player;
            if (length) { p.dx = input.x / length; p.dy = input.y / length; }
            for (let k = 0; k < count; k++) {
                p.vx = length ? p.dx * 176 * Math.min(1, length) : 0; p.vy = length ? p.dy * 176 * Math.min(1, length) : 0;
                if (state.attack) { p.vx += state.attack.dx * state.attack.speed; p.vy += state.attack.dy * state.attack.speed; }
                p.x += p.vx * step; p.y += p.vy * step; boundary(p, false);
                for (const npc of state.people) {
                    if (!flying(npc) && npc.stun <= 0) { npc.vx = 0; npc.vy = npc.speed * npc.direction; }
                    npc.x += npc.vx * step; npc.y += npc.vy * step;
                    if (!flying(npc) && npc.stun > 0) { npc.stun -= step; npc.vx *= Math.exp(-step * 5); npc.vy *= Math.exp(-step * 5); }
                    const outgoing = !flying(npc) && (npc.y < 78 || npc.y > height - 28);
                    boundary(npc, true); if (outgoing) npc.direction *= -1;
                }
                resolveBodies(true);
                for (let iteration = 0; iteration < 7; iteration++) if (!resolveBodies(false)) break;
                updatePhones(step);
                if (state.attack) { state.attack.life -= step; if (state.attack.life <= 0) state.attack = null; }
            }
            for (const particle of state.particles) {
                particle.life -= elapsed; particle.age = (particle.age || 0) + elapsed;
                if (particle.type !== 'phone') { particle.x += particle.vx * simulated; particle.y += particle.vy * simulated; }
            }
            state.particles = state.particles.filter(p => p.life > 0);
            for (const notice of state.notices) notice.life -= elapsed;
            state.notices = state.notices.filter(n => n.life > 0);
        }
        return { state, start, selectMode, attack, update, pause, resume };
    }
    const api = { createGame, MODES, RULES };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SmartphoneRush = api;
})(typeof window !== 'undefined' ? window : globalThis);

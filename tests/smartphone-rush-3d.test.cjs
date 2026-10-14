const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRenderer, multiply, perspective, lookAt, project } = require('../u-t-on/games/smartphone-rush-3d.js');
const { createGame } = require('../u-t-on/games/smartphone-rush-engine.js');
test('Perspective camera projects right/forward/up in the expected screen directions', () => {
    const matrix = multiply(perspective(Math.PI * .25, 560 / 620, 10, 2200), lookAt([0, 790, 480], [0, 0, -8]));
    const center = project(matrix, 0, 0, -8, 560, 620);
    assert.ok(Math.abs(center.x - 280) < .001); assert.ok(Math.abs(center.y - 310) < .001);
    assert.ok(project(matrix, 100, 0, -8, 560, 620).x > center.x);
    assert.ok(project(matrix, 0, 0, -100, 560, 620).y < center.y);
    assert.ok(project(matrix, 0, 60, -8, 560, 620).y < center.y);
});
test('Renderer returns a clean fallback when WebGL is unavailable', () => {
    assert.equal(createRenderer({ getContext: () => null }), null);
});
test('Scene batches finite vertices within capacity and projects scores above players', () => {
    let uploaded, drawn = 0;
    const gl = new Proxy({
        getShaderParameter: () => true, getProgramParameter: () => true, isContextLost: () => false,
        getAttribLocation: () => 0, bufferData: (_, data) => { uploaded = data; }, drawArrays: (_, __, count) => { drawn = count; }
    }, { get: (target, key) => key in target ? target[key] : () => ({}) });
    const renderer = createRenderer({ getContext: () => gl });
    const game = createGame({ random: () => .4 }); game.start();
    for (const npc of game.state.people) Object.assign(npc, { hasPhone: false, flightTime: 10, vx: 310, vy: 0 });
    game.state.particles = game.state.people.flatMap(npc => [
        { type: 'phone', x: npc.x, y: npc.y, age: .4, life: .7, broken: true },
        { type: 'ring', x: npc.x, y: npc.y, age: .1, life: .25 }
    ]);
    renderer.render(game.state);
    assert.ok(drawn > 1000); assert.equal(drawn * 9, uploaded.length); assert.ok(uploaded.length <= 360000);
    assert.ok(uploaded.every(Number.isFinite));
    const p = game.state.player;
    assert.ok(renderer.project(p.x, 76, p.y).y < renderer.project(p.x, 0, p.y).y);
});

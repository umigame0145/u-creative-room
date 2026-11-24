const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../u-t-on/tools/amidakuji-core.js');
function seeded(seed) { return max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 4294967296 * max); }; }
test('Known crossings trace the exact path and preserve distinct endpoints', () => {
    const board = { n: 3, rows: [0, 1, 0], bottoms: [true, false, false] };
    assert.deepEqual([0, 1, 2].map(i => C.trace(board, i).end), [2, 1, 0]);
    assert.equal(C.trace(board, 2).win, true);
    assert.deepEqual(C.trace(board, 0).points, [[0,0],[0,.25],[1,.25],[1,.5],[2,.5],[2,1]]);
    assert.equal(C.trace({n:2, rows:[], bottoms:[true,false]}, 1).end, 1);
});
test('Every supported size and win count has exact winners and a bijective route', () => {
    for (let n = 2; n <= 20; n++) for (let wins = 1; wins < n; wins++) {
        const b = C.generate(n, wins, seeded(n * 31 + wins));
        assert.equal(b.bottoms.filter(Boolean).length, wins);
        const routes = Array.from({length:n}, (_,i) => C.trace(b,i));
        assert.equal(new Set(routes.map(r => r.end)).size, n);
        assert.equal(routes.filter(r => r.win).length, wins);
        assert.ok(b.rows.every(left => left >= 0 && left < n - 1));
    }
});
test('Shuffle moves winners and invalid counts or starts are rejected', () => {
    assert.deepEqual(C.generate(4, 2, () => 0).bottoms, [true, false, false, true]);
    for (const args of [[1,1],[21,1],[3,0],[3,3],[3,1.5],[NaN,1]]) assert.throws(() => C.generate(...args), RangeError);
    assert.throws(() => C.trace(C.generate(2,1),2), RangeError);
    assert.throws(() => C.trace({n:2,rows:[1],bottoms:[true,false]},0), RangeError);
});

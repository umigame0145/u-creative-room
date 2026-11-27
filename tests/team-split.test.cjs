const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../u-t-on/tools/team-split-core.js');
function seeded(seed) { return max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 4294967296 * max); }; }
test('Every supported size and team count is balanced and includes each member exactly once', () => {
    for (let n = 2; n <= 500; n++) {
        const names = C.members(n);
        for (let count = 2; count <= n; count++) {
            const teams = C.split(names, count, seeded(n * 31 + count));
            const sizes = teams.map(team => team.length);
            assert.equal(teams.length, count);
            assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
            assert.ok(Math.min(...sizes) > 0);
            assert.deepEqual(teams.flat().sort(), names.slice().sort());
        }
    }
});
test('Names override count, trim whitespace, ignore blank lines and preserve duplicate participants', () => {
    assert.deepEqual(C.members(NaN, ' あおい \r\n\nけん\n あおい '), ['あおい', 'けん', 'あおい']);
    assert.deepEqual(C.members(2, '\n '), ['メンバー1', 'メンバー2']);
    assert.deepEqual(C.split(['同名', '同名', '別名'], 2, () => 0).flat().sort(), ['同名', '同名', '別名'].sort());
});
test('Shuffle is deterministic with supplied randomness and never mutates inputs', () => {
    const names = Object.freeze(['a', 'b', 'c', 'd', 'e']);
    assert.deepEqual(C.split(names, 2, () => 0), [['b', 'd', 'a'], ['c', 'e']]);
    assert.deepEqual(C.split(names, 2, max => max - 1), [['a', 'c', 'e'], ['b', 'd']]);
    assert.deepEqual(C.split(names, 3, seeded(9)), C.split(names, 3, seeded(9)));
});
test('Invalid counts, names, team counts and random values are rejected', () => {
    for (const n of [0, 1, 501, 2.5, NaN, Infinity, '3']) assert.throws(() => C.members(n), RangeError);
    for (const text of ['一人', 'a'.repeat(41) + '\nb', Array(501).fill('a').join('\n')]) assert.throws(() => C.members(5, text), RangeError);
    assert.throws(() => C.members(3, null), TypeError);
    for (const names of [[], ['a'], ['a', ' '], ['a', 2], ['a', 'b'.repeat(41)]]) assert.throws(() => C.split(names, 2, () => 0), RangeError);
    assert.throws(() => C.split(null, 2, () => 0), TypeError);
    for (const count of [0, 1, 4, 2.5, NaN, '2']) assert.throws(() => C.split(['a','b','c'], count, () => 0), RangeError);
    assert.throws(() => C.split(['a','b'], 2), TypeError);
    for (const value of [-1, 2, .5, NaN]) assert.throws(() => C.split(['a','b'], 2, () => value), RangeError);
});

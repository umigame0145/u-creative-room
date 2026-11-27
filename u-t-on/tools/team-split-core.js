/* Pure core: randomness is supplied by the caller. Shared by browsers and Node. */
(function (root) {
    'use strict';
    function members(count, text = '') {
        if (typeof text !== 'string') throw new TypeError('名前は文字列で入力してください。');
        const names = text.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
        const n = names.length || count;
        if (!Number.isInteger(n) || n < 2 || n > 500) throw new RangeError('人数は2〜500人で指定してください。');
        if (names.some(name => name.length > 40)) throw new RangeError('名前は1人40文字までです。');
        return names.length ? names : Array.from({ length: n }, (_, i) => `メンバー${i + 1}`);
    }
    function split(names, teamCount, pick) {
        if (!Array.isArray(names)) throw new TypeError('メンバーの配列が必要です。');
        if (names.length < 2 || names.length > 500 || names.some(name => typeof name !== 'string' || !name.trim() || name.length > 40)) throw new RangeError('メンバーは2〜500人、名前は1〜40文字で指定してください。');
        if (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > names.length) throw new RangeError('チーム数は2〜人数で指定してください。');
        if (typeof pick !== 'function') throw new TypeError('乱数関数が必要です。');
        const shuffled = names.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = pick(i + 1);
            if (!Number.isInteger(j) || j < 0 || j > i) throw new RangeError('乱数の範囲が不正です。');
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const teams = Array.from({ length: teamCount }, () => []);
        shuffled.forEach((name, i) => teams[i % teamCount].push(name));
        return teams;
    }
    const api = { members, split };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.TeamSplitCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

/* Shared by the browser and Node unit tests. Each row contains one adjacent swap. */
(function (root) {
    'use strict';
    function validateCount(n) {
        if (!Number.isInteger(n) || n < 2 || n > 20) throw new RangeError('人数は2〜20人です。');
    }
    function randomIndex(max) {
        if (root.crypto && root.crypto.getRandomValues) {
            const limit = Math.floor(4294967296 / max) * max;
            const buffer = new Uint32Array(1);
            do { root.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
            return buffer[0] % max;
        }
        return Math.floor(Math.random() * max);
    }
    function generate(n, wins, pick = randomIndex) {
        validateCount(n);
        if (!Number.isInteger(wins) || wins < 1 || wins >= n) throw new RangeError('当たり数は1〜人数-1です。');
        const rows = Array.from({ length: n * 4 }, () => pick(n - 1));
        const bottoms = Array.from({ length: n }, (_, i) => i < wins);
        for (let i = n - 1; i > 0; i--) {
            const j = pick(i + 1);
            [bottoms[i], bottoms[j]] = [bottoms[j], bottoms[i]];
        }
        return { n, rows, bottoms };
    }
    function trace(board, start) {
        validateCount(board.n);
        if (!Number.isInteger(start) || start < 0 || start >= board.n) throw new RangeError('スタート位置が不正です。');
        let column = start;
        const points = [[column, 0]];
        board.rows.forEach((left, index) => {
            if (!Number.isInteger(left) || left < 0 || left >= board.n - 1) throw new RangeError('横線が不正です。');
            const y = (index + 1) / (board.rows.length + 1);
            if (column === left || column === left + 1) {
                points.push([column, y]);
                column = column === left ? left + 1 : left;
                points.push([column, y]);
            }
        });
        points.push([column, 1]);
        return { end: column, win: board.bottoms[column], points };
    }
    const api = { generate, trace };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.AmidakujiCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

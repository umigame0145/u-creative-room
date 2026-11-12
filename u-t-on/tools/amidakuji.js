(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const names = ['あおい', 'けん', 'さき', 'たく', 'なお'];
    let board, hidden = true, linesHidden = false, busy = false;
    const revealed = new Set();
    const svgNS = 'http://www.w3.org/2000/svg';
    function svg(tag, attrs, text) {
        const node = document.createElementNS(svgNS, tag);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        if (text !== undefined) node.textContent = text;
        return node;
    }
    const label = i => `${i + 1}. ${names[i].trim() || '参加者' + (i + 1)}`;
    const x = i => 48 + i * 96;
    // Reserve clear vertical segments above and below every possible rung.
    const y = fraction => fraction === 0 ? 12 : fraction === 1 ? 492 : 44 + fraction * 416;
    function setLinesHidden(value) {
        linesHidden = value;
        $('toggle-lines').textContent = value ? '横線を表示' : '横線を隠す';
        $('toggle-lines').setAttribute('aria-pressed', String(value));
        const cover = $('board').querySelector('.amida-mosaic');
        if (cover) {
            cover.style.display = value ? '' : 'none';
            // Also cover previously revealed paths when hiding the board again.
            if (value) $('board').append(cover);
        }
    }
    function renderNames() {
        $('names').replaceChildren();
        names.forEach((name, i) => {
            const row = document.createElement('div'); row.className = 'amida-name';
            const input = document.createElement('input');
            input.type = 'text'; input.maxLength = 20; input.value = name;
            input.setAttribute('aria-label', `参加者${i + 1}の名前`);
            input.addEventListener('input', () => { names[i] = input.value; reset(); });
            const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '削除';
            remove.disabled = names.length <= 2;
            remove.setAttribute('aria-label', `参加者${i + 1}を削除`);
            remove.addEventListener('click', () => { names.splice(i, 1); renderNames(); reset(); });
            row.append(input, remove); $('names').append(row);
        });
        $('add-name').disabled = names.length >= 20;
    }
    function results() {
        $('results').replaceChildren();
        names.forEach((_, i) => {
            const li = document.createElement('li');
            li.textContent = `${names[i].trim() || '参加者' + (i + 1)}：${revealed.has(i) ? (AmidakujiCore.trace(board, i).win ? '当たり' : 'はずれ') : '未確認'}`;
            $('results').append(li);
        });
    }
    function draw() {
        const width = names.length * 96;
        $('board-wrap').style.minWidth = width + 'px';
        $('starts').style.gridTemplateColumns = `repeat(${names.length}, minmax(0, 1fr))`;
        // Match the start columns (including their padding) to the SVG coordinates.
        $('starts').style.paddingLeft = '0'; $('starts').style.paddingRight = '0';
        $('starts').replaceChildren();
        names.forEach((_, i) => {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = label(i);
            button.addEventListener('click', () => run([i])); $('starts').append(button);
        });
        const drawing = $('board'); drawing.replaceChildren(); drawing.setAttribute('viewBox', `0 0 ${width} 530`);
        names.forEach((_, i) => drawing.append(svg('line', { x1: x(i), y1: y(0), x2: x(i), y2: y(1), stroke: '#94a3b8', 'stroke-width': 2 })));
        board.rows.forEach((left, i) => drawing.append(svg('line', { x1: x(left), x2: x(left + 1), y1: y((i + 1) / (board.rows.length + 1)), y2: y((i + 1) / (board.rows.length + 1)), stroke: '#94a3b8', 'stroke-width': 2 })));
        // Opaque tiles are independent of the rungs: no blurred line can leak through.
        const defs = svg('defs', {});
        const pattern = svg('pattern', { id: 'amida-mosaic-pattern', width: 64, height: 64, patternUnits: 'userSpaceOnUse' });
        const colors = ['#cbd5e1', '#94a3b8', '#e2e8f0', '#64748b'];
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                pattern.append(svg('rect', { x: col * 16, y: row * 16, width: 16, height: 16, fill: colors[(row * 3 + col * 5 + row * col) % colors.length] }));
            }
        }
        defs.append(pattern); drawing.append(defs);
        drawing.append(svg('rect', { x: 0, y: 40, width, height: 424, fill: 'url(#amida-mosaic-pattern)', class: 'amida-mosaic', 'aria-hidden': 'true', 'shape-rendering': 'crispEdges' }));
        setLinesHidden(linesHidden);
        board.bottoms.forEach((win, i) => drawing.append(svg('text', { x: x(i), y: 518, 'text-anchor': 'middle', class: 'amida-bottom' + (!hidden && win ? ' winner' : '') }, hidden ? '？' : win ? '当たり' : 'はずれ')));
    }
    function reset() {
        const field = $('win-count'); field.max = names.length - 1;
        const count = Math.max(1, Math.min(names.length - 1, Math.trunc(Number(field.value) || 1)));
        field.value = count;
        board = AmidakujiCore.generate(names.length, count); revealed.clear(); draw(); results();
        $('status').textContent = '新しいあみだくじを作りました。上端の名前を選んでください。';
    }
    function lock(value) {
        busy = value;
        document.querySelectorAll('.amida-layout button, .amida-layout input').forEach(node => { node.disabled = value; });
        if (!value) {
            $('add-name').disabled = names.length >= 20;
            document.querySelectorAll('.amida-name button').forEach(node => { node.disabled = names.length <= 2; });
        }
    }
    async function run(indices) {
        if (busy) return;
        setLinesHidden(false);
        lock(true); $('status').textContent = '線をたどっています…';
        $('board').querySelectorAll('.amida-path').forEach(node => node.remove());
        try {
            const animations = indices.map(i => {
                const path = svg('polyline', { points: AmidakujiCore.trace(board, i).points.map(([column, fraction]) => `${x(column)},${y(fraction)}`).join(' '), class: 'amida-path' });
                $('board').append(path);
                const length = path.getTotalLength();
                if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !path.animate) return Promise.resolve();
                return path.animate([{ strokeDasharray: `${length} ${length}`, strokeDashoffset: length }, { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 }], { duration: 1700, easing: 'linear' }).finished;
            });
            await Promise.all(animations);
            indices.forEach(i => revealed.add(i)); results();
            $('status').textContent = indices.length === 1 ? `${label(indices[0])}：${AmidakujiCore.trace(board, indices[0]).win ? '当たり' : 'はずれ'}` : `全員の結果を表示しました。当たりは${board.bottoms.filter(Boolean).length}人です。`;
        } finally { lock(false); }
    }
    $('add-name').addEventListener('click', () => { if (names.length >= 20) return; names.push(''); renderNames(); reset(); $('names').lastElementChild.querySelector('input').focus(); });
    $('win-count').addEventListener('change', reset);
    $('regenerate').addEventListener('click', reset);
    $('show-all').addEventListener('click', () => run(names.map((_, i) => i)));
    $('toggle-lines').addEventListener('click', () => setLinesHidden(!linesHidden));
    $('toggle-bottom').addEventListener('click', () => {
        hidden = !hidden; $('toggle-bottom').textContent = hidden ? '当たりを表示' : '当たりを隠す';
        $('toggle-bottom').setAttribute('aria-pressed', String(hidden));
        $('board').querySelectorAll('.amida-bottom').forEach((node, i) => {
            node.textContent = hidden ? '？' : board.bottoms[i] ? '当たり' : 'はずれ';
            node.classList.toggle('winner', !hidden && board.bottoms[i]);
        });
    });
    renderNames(); reset();
})();

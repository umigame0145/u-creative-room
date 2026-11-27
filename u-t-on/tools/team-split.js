(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    let output = '', revision = 0;
    function pick(max) {
        if (globalThis.crypto && globalThis.crypto.getRandomValues) {
            const limit = Math.floor(4294967296 / max) * max;
            const buffer = new Uint32Array(1);
            do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
            return buffer[0] % max;
        }
        return Math.floor(Math.random() * max);
    }
    function invalidate() {
        revision++;
        output = '';
        $('results').replaceChildren();
        $('copy-result').disabled = true;
        $('regenerate').disabled = true;
        $('member-count').disabled = Boolean($('member-names').value.trim());
        $('status').textContent = '設定を確認して「チーム分けする」を押してください。';
    }
    function generate() {
        invalidate();
        try {
            const names = TeamSplitCore.members(Number($('member-count').value), $('member-names').value);
            const teams = TeamSplitCore.split(names, Number($('team-count').value), pick);
            output = teams.map((team, i) => `チーム${i + 1}（${team.length}人）\n${team.join('\n')}`).join('\n\n');
            teams.forEach((team, i) => {
                const section = document.createElement('section'); section.className = 'team-card';
                const title = document.createElement('h3'); title.textContent = `チーム${i + 1}（${team.length}人）`;
                const list = document.createElement('ul');
                team.forEach(name => { const li = document.createElement('li'); li.textContent = name; list.append(li); });
                section.append(title, list); $('results').append(section);
            });
            $('copy-result').disabled = false;
            $('regenerate').disabled = false;
            $('status').textContent = `${names.length}人を${teams.length}チームに分けました。`;
        } catch (error) { $('status').textContent = error.message; }
    }
    $('settings').addEventListener('submit', event => { event.preventDefault(); generate(); });
    for (const id of ['member-count', 'member-names', 'team-count']) $(id).addEventListener('input', invalidate);
    $('regenerate').addEventListener('click', generate);
    $('copy-result').addEventListener('click', async () => {
        const current = revision;
        try {
            await navigator.clipboard.writeText(output);
            if (current === revision) $('status').textContent = '結果をコピーしました。';
        } catch {
            if (current === revision) $('status').textContent = 'コピーできませんでした。結果の文字を選択してコピーしてください。';
        }
    });
    invalidate();
})();

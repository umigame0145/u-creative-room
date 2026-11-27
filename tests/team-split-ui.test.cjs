const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
function setup(t) {
    const dom = new JSDOM(fs.readFileSync('u-t-on/tools/team-split.html', 'utf8'), { runScripts: 'outside-only' });
    t.after(() => dom.window.close());
    for (const file of ['team-split-core.js', 'team-split.js']) dom.window.eval(fs.readFileSync('u-t-on/tools/' + file, 'utf8'));
    const w = dom.window, d = w.document;
    const edit = (id, value) => { d.getElementById(id).value = value; d.getElementById(id).dispatchEvent(new w.Event('input')); };
    const generate = () => d.getElementById('settings').dispatchEvent(new w.Event('submit', { cancelable: true }));
    return { w, d, edit, generate };
}
test('Number mode, reshuffle and copying use the displayed balanced teams', async t => {
    const { w, d, generate } = setup(t);
    assert.equal(d.getElementById('copy-result').disabled, true);
    generate();
    assert.deepEqual([...d.querySelectorAll('#results ul')].map(n => n.children.length), [4,3,3]);
    assert.equal(new Set([...d.querySelectorAll('#results li')].map(n => n.textContent)).size, 10);
    d.getElementById('regenerate').click();
    let copied;
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async text => { copied = text; } } });
    d.getElementById('copy-result').click();
    await new Promise(resolve => setImmediate(resolve));
    const expected = [...d.querySelectorAll('.team-card')].map(card => card.querySelector('h3').textContent + '\n' + [...card.querySelectorAll('li')].map(li => li.textContent).join('\n')).join('\n\n');
    assert.equal(copied, expected);
    assert.equal(d.getElementById('status').textContent, '結果をコピーしました。');
});
test('Names render as text, edits clear old results, invalid settings show errors and clipboard failure is handled', async t => {
    const { d, edit, generate } = setup(t);
    edit('member-names', '<b>ダミー</b>\n\n あおい \nけん');
    assert.equal(d.getElementById('member-count').disabled, true);
    edit('team-count', 2); generate();
    assert.equal(d.querySelectorAll('#results li').length, 3);
    assert.equal(d.querySelector('#results b'), null);
    assert.ok(d.getElementById('results').textContent.includes('<b>ダミー</b>'));
    d.getElementById('copy-result').click();
    await new Promise(resolve => setImmediate(resolve));
    assert.match(d.getElementById('status').textContent, /コピーできません/);
    edit('team-count', 4);
    assert.equal(d.getElementById('results').children.length, 0);
    assert.equal(d.getElementById('copy-result').disabled, true);
    generate(); assert.match(d.getElementById('status').textContent, /チーム数は/);
    edit('member-names', ''); assert.equal(d.getElementById('member-count').disabled, false);
});
test('Page has no inline scripts or handlers', () => {
    const d = new JSDOM(fs.readFileSync('u-t-on/tools/team-split.html', 'utf8')).window.document;
    assert.equal(d.querySelectorAll('script:not([src])').length, 0);
    for (const element of d.querySelectorAll('*')) for (const attribute of element.attributes) assert.ok(!/^on/i.test(attribute.name));
});

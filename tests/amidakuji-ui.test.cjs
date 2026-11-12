const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
function setup(t) {
    const dom = new JSDOM(fs.readFileSync('u-t-on/tools/amidakuji.html', 'utf8'), {runScripts:'outside-only'});
    t.after(() => dom.window.close());
    dom.window.SVGElement.prototype.getTotalLength = () => 700;
    dom.window.matchMedia = () => ({matches:true});
    for (const file of ['amidakuji-core.js','amidakuji.js']) dom.window.eval(fs.readFileSync('u-t-on/tools/' + file,'utf8'));
    return dom.window;
}
test('All results, hidden labels, reset and name edits stay consistent', async t => {
    const w = setup(t), d = w.document;
    assert.equal(d.querySelectorAll('#starts button').length,5);
    assert.ok([...d.querySelectorAll('.amida-bottom')].every(n => n.textContent === '？'));
    d.getElementById('show-all').click();
    assert.equal(d.getElementById('regenerate').disabled,true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal([...d.querySelectorAll('#results li')].filter(n => n.textContent.endsWith('当たり')).length,2);
    d.getElementById('toggle-bottom').click();
    assert.equal(d.querySelectorAll('.amida-bottom.winner').length,2);
    d.getElementById('regenerate').click();
    assert.ok([...d.querySelectorAll('#results li')].every(n => n.textContent.endsWith('未確認')));
    const input = d.querySelector('#names input'); input.value = '<b>名前</b>'; input.dispatchEvent(new w.Event('input'));
    assert.equal(d.querySelector('#starts button').textContent,'1. <b>名前</b>');
    assert.equal(d.querySelector('#starts b'),null);
});
test('Participant limits and winner count adjust after removal', t => {
    const w=setup(t), d=w.document;
    const count=d.getElementById('win-count'); count.value=4; count.dispatchEvent(new w.Event('change'));
    for(let i=0;i<3;i++) d.querySelector('.amida-name button').click();
    assert.equal(d.querySelectorAll('#names input').length,2);
    assert.equal(count.value,'1'); assert.equal(d.querySelector('.amida-name button').disabled,true);
    for(let i=0;i<18;i++) d.getElementById('add-name').click();
    assert.equal(d.querySelectorAll('#names input').length,20);
    assert.equal(d.getElementById('add-name').disabled,true);
});
test('Mosaic covers every rung while keeping both vertical ends clear', t => {
    const d = setup(t).document;
    const toggle = d.getElementById('toggle-lines');
    assert.equal(toggle.textContent, '横線を隠す');
    toggle.click();
    assert.equal(toggle.textContent, '横線を表示');
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    for (const count of [5, 20, 2]) {
        while (d.querySelectorAll('#names input').length < count) d.getElementById('add-name').click();
        while (d.querySelectorAll('#names input').length > count) d.querySelector('.amida-name button').click();
        const cover = d.querySelector('.amida-mosaic');
        assert.equal(cover.style.display, '');
        assert.equal(Number(cover.getAttribute('width')), count * 96);
        const top = Number(cover.getAttribute('y'));
        const bottom = top + Number(cover.getAttribute('height'));
        const lines = [...d.querySelectorAll('#board > line')];
        for (const line of lines) {
            const y1 = Number(line.getAttribute('y1')), y2 = Number(line.getAttribute('y2'));
            if (y1 === y2) assert.ok(y1 > top && y1 < bottom);
            else assert.ok(y1 < top && y2 > bottom);
            assert.ok(line.compareDocumentPosition(cover) & 4);
        }
        assert.equal(d.querySelectorAll('#amida-mosaic-pattern rect').length, 16);
    }
    toggle.click();
    assert.equal(d.querySelector('.amida-mosaic').style.display, 'none');
    assert.equal(toggle.getAttribute('aria-pressed'), 'false');
});
test('Starting an animation reveals the lines and keeps the toggle locked until completion', async t => {
    const w = setup(t), d = w.document;
    w.matchMedia = () => ({matches:false});
    let finish;
    w.SVGElement.prototype.animate = () => ({finished: new Promise(resolve => { finish = resolve; })});
    d.getElementById('toggle-lines').click();
    d.querySelector('#starts button').click();
    assert.equal(d.querySelector('.amida-mosaic').style.display, 'none');
    assert.equal(d.getElementById('toggle-lines').textContent, '横線を隠す');
    assert.equal(d.getElementById('toggle-lines').disabled, true);
    finish();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(d.getElementById('toggle-lines').disabled, false);
    assert.equal(d.querySelector('.amida-mosaic').style.display, 'none');
    assert.notEqual(d.querySelector('#results li').textContent, 'あおい：未確認');
    d.getElementById('toggle-lines').click();
    assert.equal(d.querySelector('.amida-mosaic').style.display, '');
    assert.equal(d.getElementById('board').lastElementChild, d.querySelector('.amida-mosaic'));
    w.SVGElement.prototype.animate = () => ({finished: Promise.resolve()});
    d.getElementById('show-all').click();
    assert.equal(d.querySelector('.amida-mosaic').style.display, 'none');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(d.getElementById('toggle-lines').disabled, false);
});
test('Result numbers come only from the ordered list and remove buttons cannot wrap', t => {
    const d = setup(t).document;
    assert.equal(d.getElementById('results').tagName, 'OL');
    assert.equal(d.querySelector('#results li').textContent, 'あおい：未確認');
    const style = d.createElement('style');
    style.textContent = fs.readFileSync('u-t-on/tools/amidakuji.css', 'utf8');
    d.head.append(style);
    const removeStyle = d.defaultView.getComputedStyle(d.querySelector('.amida-name button'));
    assert.equal(removeStyle.whiteSpace, 'nowrap');
    assert.equal(removeStyle.flexShrink, '0');
    assert.equal(removeStyle.minWidth, '58px');
});

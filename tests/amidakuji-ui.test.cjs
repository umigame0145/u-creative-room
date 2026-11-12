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

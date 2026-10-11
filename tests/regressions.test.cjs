const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
async function setup(file, prepare = () => {}) {
    const html = fs.readFileSync('u-t-on/' + file, 'utf8');
    const dom = new JSDOM(html, { url: 'http://localhost/' + file, runScripts: 'outside-only', pretendToBeVisual: true });
    await new Promise(resolve => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    const w = dom.window;
    w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
    w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = () => {};
    const draws = [];
    w.HTMLCanvasElement.prototype.getContext = function() {
        if (!this.testContext) this.testContext = new Proxy({ canvas: this, drawImage: (...args) => draws.push({ canvas: this, args }), measureText: () => ({ width: 10 }) }, { get: (target, key) => key in target ? target[key] : () => {} });
        return this.testContext;
    };
    w.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,test';
    const run = relative => vm.runInContext(fs.readFileSync('u-t-on/' + relative, 'utf8'), dom.getInternalVMContext(), { filename: relative });
    run('common/tool-utils.js');
    prepare(w);
    for (const script of w.document.querySelectorAll('script[src]')) {
        const src = script.getAttribute('src').split('?')[0];
        if (/^https?:/.test(src) || src.endsWith('tool-utils.js')) continue;
        const path = require('node:path').posix.normalize(require('node:path').posix.join(require('node:path').posix.dirname(file), src));
        run(path);
    }
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    return { dom, w, draws, eval: source => vm.runInContext(source, dom.getInternalVMContext()) };
}
test('CSV round-trip preserves commas, quotes, Japanese, emoji, CRLF and empty fields', async t => {
    const env = await setup('index.html'); t.after(() => env.dom.window.close());
    const fields = ['挨拶,例', '"引用"', '改行\r\n絵文字😀', '', '最後'];
    const csv = '\uFEFF' + fields.map(env.w.ToolUtils.csvField).join(',') + '\r\n';
    assert.deepEqual(Array.from(env.w.ToolUtils.parseCSV(csv)[0]), fields);
    assert.throws(() => env.w.ToolUtils.parseCSV('"未完'), /引用符/);
});
test('Navigation closes with Escape, returns focus and filters progressively', async t => {
    const env = await setup('index.html'); t.after(() => env.dom.window.close()); const d = env.w.document;
    d.getElementById('menuBtn').click();
    assert.equal(d.getElementById('menuDrawer').hidden, false);
    assert.equal(d.querySelector('main').inert, true);
    d.getElementById('closeBtn').dispatchEvent(new env.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(d.getElementById('menuDrawer').hidden, true);
    assert.equal(d.activeElement.id, 'menuBtn');
    d.querySelector('[data-filter="image"]').click();
    assert.equal(d.getElementById('tool-count').textContent, '4個のツール');
    const input = d.getElementById('tool-search'); input.value = 'モザイク'; input.dispatchEvent(new env.w.Event('input'));
    assert.equal(d.getElementById('tool-count').textContent, '1個のツール');
    input.value = '存在しない'; input.dispatchEvent(new env.w.Event('input'));
    assert.equal(d.getElementById('no-tools').hidden, false);
});
test('Vertical and horizontal image joins use the correct canvas coordinates', async t => {
    const env = await setup('tools/image-joiner.html'); t.after(() => env.dom.window.close());
    env.eval('images = [{img: {width: 100, height: 60}}, {img: {width: 100, height: 40}}]');
    env.w.document.getElementById('sizeBase').value = 'max';
    await env.w.processImages();
    assert.equal(env.w.document.getElementById('resultCanvas').height, 100);
    assert.deepEqual(env.draws.map(draw => draw.args.slice(1)), [[0, 0, 100, 60], [0, 60, 100, 40]]);
    env.draws.length = 0; env.eval("orientation = 'h'"); await env.w.processImages();
    assert.equal(env.w.document.getElementById('resultCanvas').width, 250);
    assert.deepEqual(env.draws.map(draw => draw.args.slice(1)), [[0, 0, 100, 60], [100, 0, 150, 60]]);
});
test('Image reorder and deletion invalidate output and hide the empty list', async t => {
    const env = await setup('tools/image-joiner.html'); t.after(() => env.dom.window.close());
    env.eval("images = [{img: {src: 'data:a'}, name: 'A'}, {img: {src: 'data:b'}, name: 'B'}]");
    env.w.moveImage(0, 1); assert.equal(env.eval('images[0].name'), 'B');
    env.w.removeImage(1); env.w.removeImage(0);
    assert.equal(env.w.document.getElementById('sortSection').classList.contains('hidden'), true);
    assert.equal(env.w.document.getElementById('generateBtn').disabled, true);
});
test('Unscaled image joins preserve individual dimensions and leave background margins', async t => {
    const env = await setup('tools/image-joiner.html'); t.after(() => env.dom.window.close());
    env.eval('images = [{img: {width: 100, height: 60}}, {img: {width: 50, height: 40}}]');
    await env.w.processImages();
    assert.equal(env.w.document.getElementById('resultCanvas').height, 100);
    assert.equal(env.w.document.getElementById('resultCanvas').width, 100);
    assert.deepEqual(env.draws.map(draw => draw.args.slice(1)), [[0, 0, 100, 60], [0, 60, 50, 40]]);
});
test('Image decode errors reject instead of leaving a batch pending', async t => {
    const env = await setup('tools/image-joiner.html'); t.after(() => env.dom.window.close());
    env.w.Image = class { set src(value) { queueMicrotask(() => this.onerror()); } };
    await assert.rejects(env.w.ToolUtils.decodeImage(new env.w.File(['bad'], 'bad.png')), /画像を読み込めません/);
    await env.w.handleFiles([new env.w.File(['bad'], 'bad.png')]);
    assert.equal(env.eval('loadingImages'), false);
});
test('PDF undo keeps File objects usable for generation', async t => {
    const env = await setup('tools/img-binder-pdf.html'); t.after(() => env.dom.window.close());
    env.w.fixtureFile = new env.w.File(['image'], 'a.png');
    env.eval("state.images = [{file: fixtureFile, name: 'a.png', thumb: '', w: 100, h: 60}]; saveHistory(); state.images = []; undoAction()");
    assert.equal(env.eval('state.images[0].file'), env.w.fixtureFile);
    assert.equal(env.eval('state.images[0].file instanceof File'), true);
});
test('PDF uses B5 on the first and subsequent pages and rejects impossible margins', async t => {
    const formats = []; let saved = 0;
    const env = await setup('tools/img-binder-pdf.html', w => {
        w.jspdf = { jsPDF: class { constructor(options) { formats.push(Array.from(options.format)); this.internal = { pageSize: { getWidth: () => 182, getHeight: () => 257 } }; } addPage(format) { formats.push(Array.from(format)); } addImage() {} save() { saved++; } } };
        w.ToolUtils.decodeImage = async file => ({ image: {}, url: 'blob:test', file });
    }); t.after(() => env.dom.window.close());
    env.eval("state.images = [{file: {}, name: 'a', w: 100, h: 60}, {file: {}, name: 'b', w: 100, h: 60}]");
    env.w.document.getElementById('pageSize').value = 'b5';
    await env.w.generatePDF(); assert.deepEqual(formats, [[182, 257], [182, 257]]); assert.equal(saved, 1);
    env.w.document.getElementById('marginSize').value = '100'; await env.w.generatePDF();
    assert.equal(saved, 1); assert.match(env.w.document.getElementById('tool-notice').textContent, /余白が大きすぎ/);
    assert.equal(env.w.document.getElementById('generatePdfBtn').disabled, false);
});
test('Corrupt local storage does not prevent counter or roulette startup', async t => {
    for (const [file, key] of [['any-counter', 'any_counter_data'], ['my-roulette', 'my_roulette_data']]) {
        const env = await setup('tools/' + file + '.html', w => w.localStorage.setItem(key, '{broken'));
        t.after(() => env.dom.window.close());
        assert.ok(env.eval(file === 'any-counter' ? 'state.children.length' : 'state.items.length') > 0);
    }
});
test('Counter imports names containing quoted commas and line breaks, including empty groups', async t => {
    const env = await setup('tools/any-counter.html'); t.after(() => env.dom.window.close());
    const csv = 'Type,ID,Name,Value/Members\r\nChild,a,"A,""B""\nC",2\r\nGroup,g,"空",\r\n';
    env.w.importCSV(new env.w.File([csv], 'counter.csv'));
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(env.eval('state.children[0].name'), 'A,"B"\nC');
    assert.equal(env.eval('state.groups.length'), 1);
    assert.equal(env.eval('state.groups[0].memberIds.length'), 0);
});
test('Rapid counter updates finish at the latest total', async t => {
    const env = await setup('tools/any-counter.html'); t.after(() => env.dom.window.close());
    const id = env.eval('state.children[0].id');
    env.w.updateCount(id, 10); env.w.updateCount(id, -1); env.w.updateCount(id, 10);
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.equal(env.w.document.getElementById('totalDisplay').textContent, '19');
});
test('Roulette locks SET and configuration until stopping completes', async t => {
    const env = await setup('tools/my-roulette.html'); t.after(() => env.dom.window.close());
    env.w.spin(); env.w.stop();
    assert.equal(env.w.document.getElementById('startBtn').disabled, true);
    assert.equal(env.w.document.getElementById('modeSubBtn').disabled, true);
    env.w.handleSet(); assert.equal(env.eval('state.history.length'), 0);
    env.eval("isSpinning = false; animState = 'none'; finishSpin()");
    env.w.handleSet(); assert.equal(env.eval('state.history.length'), 1);
});
test('Roulette and saved phrases render HTML-like names as literal text', async t => {
    const roulette = await setup('tools/my-roulette.html'); t.after(() => roulette.dom.window.close());
    roulette.w.showResult('<img src=x onerror=alert(1)>');
    assert.equal(roulette.w.document.querySelector('#resultDisplay img'), null);
    const copy = await setup('tools/copy-pattan.html', w => w.localStorage.setItem('copyPattanData', JSON.stringify({ mainText: '', materials: ['" onfocus="alert(1)'], stocks: ['<img src=x onerror=alert(1)>'] })));
    t.after(() => copy.dom.window.close());
    assert.equal(copy.w.document.querySelector('#stockList img'), null);
    assert.equal(copy.w.document.querySelector('.material-input').value, '" onfocus="alert(1)');
    assert.equal(copy.w.document.querySelector('.material-input').hasAttribute('onfocus'), false);
});
test('Transparency apply, undo and clear remove preview to prevent double processing', async t => {
    const env = await setup('tools/suke-touka.html'); t.after(() => env.dom.window.close());
    env.eval('globalThis.editor = new SukeTouka()');
    env.w.editor.draw = () => {};
    env.w.editor.previewPos = { x: 10, y: 10 }; env.w.editor.applyTransparency();
    assert.equal(env.w.editor.appliedTransparencies.length, 1); assert.equal(env.w.editor.previewPos, null);
    env.w.editor.applyTransparency(); assert.equal(env.w.editor.appliedTransparencies.length, 1);
    env.w.editor.undo(); assert.equal(env.w.editor.appliedTransparencies.length, 0);
});
test('The first phrase row appends, saves and restores input on a fresh visit', async t => {
    const env = await setup('tools/copy-pattan.html'); t.after(() => env.dom.window.close());
    const d = env.w.document, input = d.querySelector('.material-input');
    input.value = '"引用",😀'; input.dispatchEvent(new env.w.Event('input', { bubbles: true }));
    d.querySelector('.add-to-main-btn').click();
    assert.equal(d.getElementById('mainTextArea').value, '"引用",😀');
    d.getElementById('saveStockBtn').click();
    assert.match(d.getElementById('stockList').textContent, /引用/);
    const stored = env.w.localStorage.getItem('copyPattanData');
    const restored = await setup('tools/copy-pattan.html', w => w.localStorage.setItem('copyPattanData', stored));
    t.after(() => restored.dom.window.close());
    assert.equal(restored.w.document.querySelector('.material-input').value, '"引用",😀');
    assert.equal(restored.w.document.getElementById('mainTextArea').value, '"引用",😀');
});
test('Image editor arrow keys do not hijack number input editing', async t => {
    const env = await setup('tools/suke-touka.html'); t.after(() => env.dom.window.close());
    env.eval('globalThis.editor = new SukeTouka()'); env.w.editor.isImageLoaded = true; env.w.editor.previewPos = { x: 10, y: 10 };
    const event = new env.w.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true });
    env.w.document.getElementById('mosaicWidth').dispatchEvent(event);
    assert.equal(event.defaultPrevented, false); assert.equal(env.w.editor.previewPos.y, 10);
});

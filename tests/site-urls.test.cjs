const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
function render(file, url) {
    const dom = new JSDOM(fs.readFileSync('u-t-on/' + file, 'utf8'), { url, runScripts: 'outside-only' });
    for (const path of ['common/site-data.js', 'common/site-manager.js']) vm.runInContext(fs.readFileSync('u-t-on/' + path, 'utf8'), dom.getInternalVMContext(), { filename: path });
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    return dom;
}
test('Shared navigation uses extensionless URLs and marks the current page', () => {
    const dom = render('tools/image-compare.html', 'https://u-t-on.com/tools/image-compare');
    try {
        const d = dom.window.document;
        const hrefs = [...d.querySelectorAll('#common-header a, #common-footer a, #menuDrawer a')].map(a => a.getAttribute('href'));
        assert.ok(hrefs.includes('/articles/') && hrefs.includes('/about') && hrefs.includes('/tools/video-frames'));
        assert.equal(hrefs.filter(href => /\.html(?:$|[#?])/.test(href)).length, 0);
        assert.equal(d.querySelector('#menuDrawer [aria-current="page"]').getAttribute('href'), '/tools/image-compare');
        assert.match(d.querySelector('.site-header img, .drawer-panel img').getAttribute('src'), /^\.\.\/common\/icon\//);
    } finally { dom.window.close(); }
});
test('Article pages resolve shared assets from the articles folder', () => {
    const dom = render('articles/index.html', 'https://u-t-on.com/articles/');
    try {
        const d = dom.window.document;
        assert.equal(d.querySelector('#menuDrawer [aria-current="page"]').getAttribute('href'), '/articles/');
        assert.match(d.querySelector('.drawer-panel img').getAttribute('src'), /^\.\.\/common\/icon\//);
        assert.equal(d.querySelectorAll('.article-card').length, 7);
    } finally { dom.window.close(); }
});
test('Canonical URLs and the sitemap use extensionless URLs', () => {
    const sitemap = fs.readFileSync('u-t-on/sitemap.xml', 'utf8');
    assert.doesNotMatch(sitemap, /\.html</);
    for (const slug of ['image-diff-rate', 'mosaic-leak', 'video-frame-rate', 'combine-screenshots', 'image-formats', 'roulette-weights', 'images-to-pdf']) {
        const html = fs.readFileSync(`u-t-on/articles/${slug}.html`, 'utf8');
        assert.match(html, new RegExp(`<link rel="canonical" href="https://u-t-on.com/articles/${slug}">`));
        assert.ok(sitemap.includes(`<loc>https://u-t-on.com/articles/${slug}</loc>`));
    }
});

test('Roulette guide is linked from the article list and both related tools', () => {
    const href = '/articles/roulette-weights';
    for (const file of ['articles/index.html', 'tools/my-roulette.html', 'tools/any-counter.html']) {
        const dom = new JSDOM(fs.readFileSync('u-t-on/' + file, 'utf8'));
        try {
            const selector = file.startsWith('articles/') ? '.article-card' : '[aria-label="関連記事"] a';
            assert.ok([...dom.window.document.querySelectorAll(selector)].some(a => a.getAttribute('href') === href), file);
        } finally { dom.window.close(); }
    }
    const dom = new JSDOM(fs.readFileSync('u-t-on/articles/roulette-weights.html', 'utf8'));
    try {
        const d = dom.window.document;
        for (const tool of ['my-roulette', 'any-counter']) {
            assert.ok(d.querySelector(`main a[href="/tools/${tool}"]`));
        }
        assert.equal(d.querySelector('meta[property="og:type"]').content, 'article');
        assert.ok(d.querySelector('.article-meta a[href="/about"]'));
        for (const a of d.querySelectorAll('.article-toc a')) {
            assert.ok(d.getElementById(a.hash.slice(1)), a.hash);
        }
        const measurement = JSON.parse(fs.readFileSync('u-t-on/common/examples/roulette-weights-measurement.json', 'utf8'));
        const rows = [...d.querySelector('#measurement + p + .table-scroll').querySelectorAll('tbody tr')];
        assert.equal(rows.length, measurement.samples.length);
        measurement.samples.forEach((sample, i) => {
            assert.equal(sample.a + sample.b, sample.n);
            const cells = [...rows[i].querySelectorAll('td')].map(td => td.textContent.replaceAll(',', ''));
            assert.equal(cells[0], String(sample.n));
            assert.equal(cells[1], `${sample.a}・${sample.b}`);
            assert.equal(cells[2], sample.percentage.replace('割合: ', '').replace('%', '％'));
            assert.equal(cells[3], sample.observedRatio.replace('観測比率: ', ''));
            assert.equal(sample.sdCount, Math.sqrt(sample.n * 0.25 * 0.75));
        });
    } finally { dom.window.close(); }
});

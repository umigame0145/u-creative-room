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
        assert.equal(d.querySelectorAll('.article-card').length, 5);
    } finally { dom.window.close(); }
});
test('Canonical URLs and the sitemap use extensionless URLs', () => {
    const sitemap = fs.readFileSync('u-t-on/sitemap.xml', 'utf8');
    assert.doesNotMatch(sitemap, /\.html</);
    for (const slug of ['image-diff-rate', 'mosaic-leak', 'video-frame-rate', 'combine-screenshots', 'image-formats']) {
        const html = fs.readFileSync(`u-t-on/articles/${slug}.html`, 'utf8');
        assert.match(html, new RegExp(`<link rel="canonical" href="https://u-t-on.com/articles/${slug}">`));
        assert.ok(sitemap.includes(`<loc>https://u-t-on.com/articles/${slug}</loc>`));
    }
});

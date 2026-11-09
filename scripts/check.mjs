import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join, relative, sep } from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { execFileSync } from 'node:child_process';
const root = resolve('u-t-on');
const origin = 'https://u-t-on.com';
let checks = 0;
const canonicals = new Map();

async function isFile(path) {
    try { return (await stat(path)).isFile(); } catch { return false; }
}
// Resolves a local link the way the production host does: "/about" and
// "about" serve about.html, "/articles/" serves articles/index.html.
async function resolveLocal(file, value) {
    const base = value.startsWith('/') ? resolve(root, '.' + value) : resolve(dirname(file), value);
    const candidates = value.endsWith('/') ? [join(base, 'index.html')] : [base, base + '.html'];
    for (const candidate of candidates) if (await isFile(candidate)) return candidate;
    return null;
}
// Public URL of a page file: about.html -> /about, articles/index.html -> /articles/
function publicPath(file) {
    const path = '/' + relative(root, file).split(sep).join('/');
    return path.replace(/(^|\/)index\.html$/, '$1').replace(/\.html$/, '');
}

async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) { await inspect(file); continue; }
        const source = await readFile(file, 'utf8');
        if (entry.name.endsWith('.js')) { new vm.Script(source, { filename: file }); checks++; }
        if (entry.name.endsWith('.mjs')) { execFileSync(process.execPath, ['--check', file]); checks++; }
        if (!entry.name.endsWith('.html')) continue;
        const document = new JSDOM(source).window.document;
        if (document.querySelectorAll('h1').length !== 1) throw new Error(`${file}: expected one h1`);
        const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
        if (!canonical) throw new Error(`${file}: missing canonical`);
        const expected = origin + publicPath(file);
        if (canonical !== expected) throw new Error(`${file}: canonical should be ${expected} (got ${canonical})`);
        const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute('content');
        if (ogUrl !== canonical) throw new Error(`${file}: og:url must match canonical`);
        canonicals.set(canonical, file);
        const ids = new Set();
        for (const element of document.querySelectorAll('[id]')) {
            if (ids.has(element.id)) throw new Error(`${file}: duplicate id ${element.id}`);
            ids.add(element.id);
        }
        for (const element of document.querySelectorAll('script:not([src])')) {
            if (!element.type || element.type === 'text/javascript') new vm.Script(element.textContent, { filename: file });
        }
        for (const element of document.querySelectorAll('[src], [href]')) {
            const value = element.getAttribute('src') ?? element.getAttribute('href');
            if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) continue;
            const path = value.split(/[?#]/)[0];
            if (!path) continue;
            if (/\.html$/.test(path)) throw new Error(`${file}: link to ${value} should use the extensionless URL`);
            if (!await resolveLocal(file, path)) throw new Error(`${file}: broken local link ${value}`);
        }
        if (/cdn\.tailwindcss\.com|user-scalable=no/.test(source)) throw new Error(`${file}: runtime CSS or disabled zoom`);
        checks++;
    }
}
await inspect(root);

// Sitemap: extensionless URLs that match a page canonical, and every page listed.
const sitemap = await readFile(join(root, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
for (const loc of locs) {
    if (!canonicals.has(loc)) throw new Error(`sitemap.xml: ${loc} is not the canonical URL of any page`);
}
for (const [url, file] of canonicals) {
    if (!locs.includes(url)) throw new Error(`sitemap.xml: missing ${url} (${file})`);
}
checks++;

// Navigation data used by the shared header/menu.
const context = vm.createContext({});
vm.runInContext(await readFile(join(root, 'common/site-data.js'), 'utf8') + '\nthis.SITE_DATA = SITE_DATA;', context);
const data = context.SITE_DATA;
const navUrls = [...data.tools, ...data.games, ...data.menuGroups.flatMap(group => group.items)].map(item => item.url);
for (const url of navUrls) {
    if (/\.html$/.test(url) || !await resolveLocal(join(root, 'index.html'), '/' + url)) throw new Error(`site-data.js: bad page URL ${url}`);
}
checks++;
console.log(`Passed: ${checks} page/script/sitemap checks and all local links (${locs.length} sitemap URLs).`);

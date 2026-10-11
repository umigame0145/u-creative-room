import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
const root = resolve('u-t-on');
let checks = 0;
async function inspect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) { await inspect(file); continue; }
        const source = await readFile(file, 'utf8');
        if (entry.name.endsWith('.js')) { new vm.Script(source, { filename: file }); checks++; }
        if (!entry.name.endsWith('.html')) continue;
        const document = new JSDOM(source).window.document;
        if (document.querySelectorAll('h1').length !== 1) throw new Error(`${file}: expected one h1`);
        if (!document.querySelector('link[rel="canonical"]')) throw new Error(`${file}: missing canonical`);
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
            const relative = value.split(/[?#]/)[0];
            if (!relative) continue;
            await access(resolve(dirname(file), relative));
        }
        if (/cdn\.tailwindcss\.com|user-scalable=no/.test(source)) throw new Error(`${file}: runtime CSS or disabled zoom`);
        checks++;
    }
}
await inspect(root);
console.log(`Passed: ${checks} page/script checks and all local asset links.`);

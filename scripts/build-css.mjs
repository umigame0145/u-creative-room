import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { compile, optimize } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
const files = [];
async function collect(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'vendor') await collect(path);
        else if (/\.(html|js)$/.test(entry.name)) files.push({ file: resolve(path), extension: entry.name.split('.').pop() });
    }
}
await collect('u-t-on');
const scanner = new Scanner({ sources: [] });
const compiler = await compile(await readFile('styles/tailwind.css', 'utf8'), { base: resolve('styles'), onDependency() {} });
const css = compiler.build(scanner.scanFiles(await Promise.all(files.map(async file => ({ content: await readFile(file.file, 'utf8'), extension: file.extension })))));
await writeFile('u-t-on/common/utilities.css', optimize(css, { minify: true }).code);
console.log('Built CSS from ' + files.length + ' local source files.');

// Run from repository root. Uses generatePDF and bundled jsPDF; records image placement without embedding pixels or saving PDFs.
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const { jsPDF } = createRequire(import.meta.url)('../u-t-on/common/vendor/jspdf-4.2.1.umd.min.js');
// Minimal DOM doubles keep this coordinate recording independent of browser packages.
const elements = new Map();
const element = () => ({ value: '', disabled: false, classList: { add() {}, remove() {} } });
const document = {
    addEventListener() {},
    getElementById(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); },
    createElement() { return { getContext: () => ({ fillRect() {}, drawImage() {} }), toDataURL: () => 'dummy' }; }
};
const w = { document, URL: { revokeObjectURL() {} } };
let pages;
w.jspdf = { jsPDF: function(options) {
    const doc = new jsPDF(options);
    pages = [];
    const recordPage = () => pages.push({ width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() });
    recordPage();
    const addPage = doc.addPage.bind(doc);
    doc.addPage = (...args) => { addPage(...args); recordPage(); return doc; };
    doc.addImage = (data, type, x, y, width, height) => { pages.at(-1).image = { x, y, width, height }; return doc; };
    doc.save = () => {};
    return doc;
} };
w.ToolUtils = { decodeImage: async () => ({ image: {}, url: 'dummy' }), notify: message => { throw Error(message); } };
w.URL.revokeObjectURL = () => {};
const context = vm.createContext({ window: w, document, URL: w.URL, ToolUtils: w.ToolUtils, setTimeout });
const run = code => vm.runInContext(code, context);
run(readFileSync('u-t-on/tools/img-binder-pdf.js', 'utf8'));
const inputs = [{ name: 'sample-plan.png', w: 600, h: 400 }, { name: 'sample-check.png', w: 300, h: 400 }, { name: 'sample-share.png', w: 600, h: 400 }];
for (const input of inputs) {
    const png = readFileSync('u-t-on/common/examples/' + input.name);
    if (png.readUInt32BE(16) !== input.w || png.readUInt32BE(20) !== input.h) throw Error('Input dimensions changed: ' + input.name);
}
run(`state.images = ${JSON.stringify(inputs)};`);
const cases = [];
for (const [size, margin, align] of [['a4',10,'mc'], ['a4',10,'tl'], ['a4',0,'mc'], ['b5',10,'mc'], ['original',0,'mc'], ['original',10,'mc']]) {
    w.document.getElementById('pageSize').value = size;
    w.document.getElementById('marginSize').value = margin;
    run(`state.align = '${align}'`);
    await run('generatePDF()');
    cases.push({ size, margin, align, pages });
}
writeFileSync('u-t-on/common/examples/images-to-pdf-layout.json', JSON.stringify({ date: '2026-11-20', method: 'Production generatePDF and bundled jsPDF page sizing; image embedding, save, canvas and decode replaced with recording doubles. Coordinates only; no PDF file or visual rendering verified.', inputs, cases }, null, 2) + '\n');
console.log('Recorded six layout cases from production generatePDF.');

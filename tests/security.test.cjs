const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
function utils(t) {
 const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
 dom.window.eval(fs.readFileSync('u-t-on/common/tool-utils.js', 'utf8')); return dom.window.ToolUtils;
}
test('Safe CSV neutralizes formula cells and restores exact backup values', t => {
 const u = utils(t); const values = ['=1+1', '+1', '-1', '@SUM(1)', '\t=1+1', '\r=1', '\n=1', ' =1', "'=1", "''", 'a,b', '"quote"', '', '日本語😀'];
 const csv = u.serializeCSV([values]); const raw = csv.split('\r\n')[1]; assert.ok(raw.startsWith('"\'=1+1"'));
 assert.deepEqual(Array.from(u.parseCSV('\uFEFF' + csv)[0]), values);
 assert.deepEqual(Array.from(u.parseCSV('"=1+1","\'literal"')[0]), ['=1+1', "'literal"]);
 assert.throws(() => u.parseCSV('UCR-TEXT-CSV-v1,apostrophe\r\n"=1+1"'), /不正/);
 assert.deepEqual(Array.from(u.parseCSV(u.serializeCSV([[]]))[0]), ['']);
});
test('Every CSV export uses the safe serializer', () => {
 for (const name of ['any-counter', 'my-roulette', 'copy-pattan']) {
  assert.match(fs.readFileSync('u-t-on/tools/' + name + '.js', 'utf8'), /ToolUtils\.serializeCSV\(rows\)/);
 }
});
test('Vendored jsPDF integrity matches and real library produces a PDF', t => {
 const html=fs.readFileSync('u-t-on/tools/img-binder-pdf.html','utf8');
 const code=fs.readFileSync('u-t-on/common/vendor/jspdf-4.2.1.umd.min.js');
 assert.ok(html.includes('sha384-'+crypto.createHash('sha384').update(code).digest('base64')));
 const dom=new JSDOM('',{runScripts:'outside-only'}); t.after(()=>dom.window.close());
 dom.window.TextEncoder=TextEncoder; dom.window.TextDecoder=TextDecoder;
 dom.window.eval(code.toString());
 const doc=new dom.window.jspdf.jsPDF({unit:'mm',format:[182,257]});
 doc.text('Security regression',10,10); doc.addPage([182,257]);
 const data=doc.output(); assert.ok(data.startsWith('%PDF-')); assert.match(data,/Security regression/); assert.equal(doc.getNumberOfPages(),2);
});
test('Security headers deny framing without disabling Google integrations', () => {
 const h=fs.readFileSync('u-t-on/_headers','utf8'); assert.match(h,/frame-ancestors 'none'/); assert.match(h,/X-Content-Type-Options: nosniff/); assert.match(h,/Strict-Transport-Security: max-age=86400/); assert.ok(!h.includes("default-src 'self'"));
});

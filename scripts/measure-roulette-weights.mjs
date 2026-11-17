// Run from the repository root: node scripts/measure-roulette-weights.mjs
// Executes the production scripts; canvas drawing alone is stubbed in jsdom.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
async function setup(slug) {
    const dom = new JSDOM(readFileSync(`u-t-on/tools/${slug}.html`, 'utf8'), {
        url: `https://u-t-on.com/tools/${slug}`, runScripts: 'outside-only', pretendToBeVisual: true
    });
    await new Promise(resolve => dom.window.document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    dom.window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: () => () => {} });
    const run = code => vm.runInContext(code, dom.getInternalVMContext());
    run(readFileSync('u-t-on/common/tool-utils.js', 'utf8'));
    run(readFileSync(`u-t-on/tools/${slug}.js`, 'utf8'));
    if (slug === 'any-counter') dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    return { dom, run };
}
const roulette = await setup('my-roulette');
const counter = await setup('any-counter');
try {
    roulette.run(`state.items = [
        {id:'a',name:'景品A',weight:1,color:'#ff4444'},
        {id:'b',name:'景品B',weight:3,color:'#44ccff'}
    ]; state.config.mode = 'probability'; resetCurrentWeights();`);
    const samples = [];
    for (const n of [100, 1000, 10000]) {
        const a = roulette.run(`(() => { let count = 0; for (let i = 0; i < ${n}; i++) {
            if (pickWinnerByWeight().id === 'a') count++;
        } return count; })()`);
        counter.run(`state.children = [{id:'a',name:'景品A',count:${a}}, {id:'b',name:'景品B',count:${n-a}}]; render();`);
        const card = counter.dom.window.document.querySelector('.counter-card');
        samples.push({ n, a, b: n-a, percentage: card.querySelector('.ratio-display').textContent,
            observedRatio: card.querySelector('.prob-display').textContent,
            expectedA: n * 0.25, sdCount: Math.sqrt(n * 0.25 * 0.75),
            sdPercentagePoints: 100 * Math.sqrt(0.25 * 0.75 / n) });
    }
    console.log(JSON.stringify({ date: '2026-11-17', node: process.version, jsdom: '26.1.0',
        method: 'Independent batches; production pickWinnerByWeight with native Math.random, probability mode, A:B=1:3; counts rendered by production counter. No animation or manual clicks simulated.', samples }, null, 2));
} finally { roulette.dom.window.close(); counter.dom.window.close(); }

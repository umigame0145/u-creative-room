/* Shared navigation and progressive enhancements. */
const siteConfig = typeof SITE_DATA !== 'undefined' ? SITE_DATA : { tools: [], icons: {}, menuGroups: [], news: [] };
const isSubPage = /\/(?:tools|games)\//.test(window.location.pathname);
const basePath = isSubPage ? '../' : './';
function getIconHtml(key, className = '') {
    const name = siteConfig.icons[key];
    return name ? `<img src="${basePath}common/icon/${name}" class="${className}" alt="" width="24" height="24">` : '';
}
function initCommonComponents() {
    const entries = [...siteConfig.tools, ...(siteConfig.games || [])];
    const currentTool = entries.find(tool => window.location.pathname.endsWith('/' + tool.url.split('/').pop()));
    const header = document.getElementById('common-header');
    if (header) header.innerHTML = `
        <a class="skip-link" href="#main-content">本文へスキップ</a>
        <header class="site-header"><div class="header-inner">
            <a class="site-brand" href="${basePath}index.html"><span class="brand-mark">U</span><span>Uの創作部屋<small>暮らしと創作の、ちいさな道具箱。</small></span></a>
            <div class="header-actions"><a class="header-home" href="${basePath}index.html#tools">ツール一覧</a>
            <button id="menuBtn" class="menu-button" type="button" aria-label="メニューを開く" aria-expanded="false" aria-controls="menuDrawer"><span aria-hidden="true">☰</span><span>メニュー</span></button></div>
        </div></header>`;
    const main = document.querySelector('main');
    if (main) main.id = 'main-content';
    const footer = document.getElementById('common-footer');
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(document.title)}&url=${encodeURIComponent(document.querySelector('link[rel="canonical"]')?.href || location.href)}`;
    if (footer) footer.innerHTML = `<footer class="site-footer"><div><a class="footer-brand" href="${basePath}index.html">Uの創作部屋</a><p>ブラウザで使える、無料の便利ツール。</p></div><nav aria-label="サイト情報"><a href="${basePath}about.html">このサイトについて</a><a href="${basePath}privacy.html">プライバシーポリシー</a><a href="${basePath}contact.html">お問い合わせ</a></nav><small>© ${new Date().getFullYear()} Uの創作部屋</small></footer>`;
    const drawer = document.createElement('div');
    if (footer) {
        const share = document.createElement('a');
        share.href = shareUrl; share.target = '_blank'; share.rel = 'noopener noreferrer';
        share.textContent = '𝕏でこのページをシェア'; footer.querySelector('nav').appendChild(share);
    }
    drawer.id = 'menuDrawer'; drawer.hidden = true; drawer.className = 'menu-drawer';
    drawer.innerHTML = `<div class="drawer-overlay"></div><div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><div class="drawer-heading"><h2 id="drawer-title">ツールを選ぶ</h2><button id="closeBtn" type="button" aria-label="メニューを閉じる">×</button></div><nav aria-label="ツールメニュー"><a class="drawer-home" href="${basePath}index.html">ホーム</a>${siteConfig.menuGroups.map(group => `<section><h3>${group.groupName}</h3>${group.items.map(item => { const tool = entries.find(t => t.url === item.url); return `<a href="${basePath}${item.url}"${tool === currentTool ? ' aria-current="page"' : ''}>${getIconHtml(tool?.icon)}<span>${item.name}</span></a>`; }).join('')}</section>`).join('')}<a href="${basePath}about.html">このサイトについて</a><a href="${basePath}contact.html">お問い合わせ</a></nav></div>`;
    document.body.appendChild(drawer);
    const menuBtn = document.getElementById('menuBtn');
    const closeBtn = document.getElementById('closeBtn');
    const inertTargets = [header, main, footer].filter(Boolean);
    let previousOverflow = '';
    function toggleMenu(open) {
        drawer.hidden = !open;
        menuBtn?.setAttribute('aria-expanded', String(open));
        inertTargets.forEach(el => { el.inert = open; });
        if (open) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; closeBtn.focus(); }
        else { document.body.style.overflow = previousOverflow; menuBtn?.focus(); }
    }
    menuBtn?.addEventListener('click', () => toggleMenu(true));
    closeBtn.addEventListener('click', () => toggleMenu(false));
    drawer.querySelector('.drawer-overlay').addEventListener('click', () => toggleMenu(false));
    drawer.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); toggleMenu(false); }
        if (event.key === 'Tab') {
            const items = [...drawer.querySelectorAll('button, a[href]')];
            const first = items[0], last = items.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });
    const search = document.getElementById('tool-search');
    const filters = [...document.querySelectorAll('[data-filter]')];
    const cards = [...document.querySelectorAll('.tool-card')];
    let category = 'all';
    function filterTools() {
        const query = search.value.trim().toLocaleLowerCase();
        let count = 0;
        cards.forEach(card => {
            const visible = (category === 'all' || card.dataset.category === category) && card.textContent.toLocaleLowerCase().includes(query);
            card.hidden = !visible;
            if (visible) count++;
        });
        document.getElementById('tool-count').textContent = `${count}個のツール`;
        document.getElementById('no-tools').hidden = count !== 0;
    }
    if (search) {
        search.addEventListener('input', filterTools);
        filters.forEach(button => button.addEventListener('click', () => {
            category = button.dataset.filter;
            filters.forEach(btn => btn.setAttribute('aria-pressed', String(btn === button)));
            filterTools();
        }));
        document.getElementById('tool-discovery').hidden = false;
    }
    // Analytics loads only on the public site, never in local previews.
    if (location.hostname === 'u-t-on.com' || location.hostname === 'www.u-t-on.com') {
        const script = document.createElement('script'); script.async = true;
        script.src = 'https://www.googletagmanager.com/gtag/js?id=G-NVBKR9BVEX'; document.head.appendChild(script);
        window.dataLayer = window.dataLayer || [];
        function gtag() { window.dataLayer.push(arguments); }
        gtag('js', new Date()); gtag('config', 'G-NVBKR9BVEX');
    }
}
document.addEventListener('DOMContentLoaded', initCommonComponents);

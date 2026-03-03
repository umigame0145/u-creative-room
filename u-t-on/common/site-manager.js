/**
 * Uの創作部屋：共通コンポーネント管理システム
 */
const siteConfig = {
    siteName: "Uの創作部屋",
    footerText: "© 2026 Uの創作部屋. All rights reserved.",
    news: typeof SITE_DATA !== 'undefined' ? SITE_DATA.news : [],
    tools: typeof SITE_DATA !== 'undefined' ? SITE_DATA.tools : [],
    menuGroups: typeof SITE_DATA !== 'undefined' ? SITE_DATA.menuGroups : []
};

// パス判定：現在のURLに /tools/ が含まれていればサブページとみなす
const isSubPage = window.location.href.includes('/tools/');
const basePath = isSubPage ? '../' : './';

function initCommonComponents() {
    // 現在のページのツール名を取得（site-data.jsのtools配列から検索）
    const currentTool = siteConfig.tools.find(t => window.location.pathname.includes(t.url.split('/').pop()));
    
    // ヘッダータイトルの構築
    let displayTitle = siteConfig.siteName;
    if (isSubPage && currentTool) {
        // ツールページにいる場合：「Uの創作部屋 > ツール名」
        displayTitle = `
            <a href="${basePath}index.html" class="hover:text-blue-600 transition-colors">${siteConfig.siteName}</a>
            <span class="mx-2 text-gray-300 font-normal">/</span>
            <span class="text-gray-500">${currentTool.name}</span>
        `;
    }
    
    // 1. ヘッダー生成
    const headerHtml = `
        <header class="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm shadow-sm border-b z-[60]">
            <div class="max-w-6xl mx-auto px-4 py-4 flex items-center">
                <button id="menuBtn" class="p-2 hover:bg-gray-100 rounded-lg transition focus:outline-none">
                    <div class="w-6 h-0.5 bg-gray-600 mb-1"></div>
                    <div class="w-6 h-0.5 bg-gray-600 mb-1"></div>
                    <div class="w-6 h-0.5 bg-gray-600"></div>
                </button>
                <div class="ml-4 text-lg font-bold text-gray-800 tracking-tight flex items-center whitespace-nowrap overflow-hidden">
                    ${displayTitle}
                </div>
            </div>
        </header>
        <div class="h-[65px]"></div>
    `;

    // 2. サイドメニュー生成
    const drawerHtml = `
        <div id="menuDrawer" class="fixed inset-0 z-[100] invisible">
            <div id="drawerOverlay" class="absolute inset-0 bg-black opacity-0 transition-opacity duration-300"></div>
            <div id="drawerContent" class="absolute inset-y-0 left-0 w-64 bg-white shadow-2xl transform -translate-x-full transition-transform duration-300 overflow-y-auto">
                <div class="p-6 border-b flex justify-between items-center bg-gray-50">
                    <span class="font-bold text-blue-600 tracking-widest text-sm">MENU</span>
                    <button id="closeBtn" class="text-gray-400 hover:text-gray-600 text-xl focus:outline-none">✕</button>
                </div>
                <nav class="p-4">
                    <div class="mb-6 pb-4 border-b">
                        <ul class="space-y-2">
                            <li><a href="${basePath}index.html" class="flex items-center gap-3 p-2 text-sm font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition">🏠 ホーム</a></li>
                        </ul>
                    </div>
                    ${siteConfig.menuGroups.map(group => `
                        <div class="mb-6">
                            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-2">${group.groupName}</p>
                            <ul class="space-y-2">
                                ${group.items.map(item => `<li><a href="${basePath}${item.url}" class="block p-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition">${item.name}</a></li>`).join('')}
                            </ul>
                        </div>
                    `).join('')}
                </nav>
            </div>
        </div>
    `;

    // 3. 各要素への流し込み
    const h = document.getElementById('common-header');
    if (h) h.innerHTML = headerHtml;

    document.body.insertAdjacentHTML('afterbegin', drawerHtml);

    const newsList = document.getElementById('news-list');
    if (newsList) {
        newsList.innerHTML = siteConfig.news.map(n => `
            <li class="flex flex-col md:flex-row md:items-start gap-2 text-sm border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <span class="font-mono text-gray-400 text-xs min-w-[80px] pt-0.5">${n.date}</span>
                <span class="text-gray-600 flex-1 leading-snug">${n.content}</span>
            </li>
        `).join('');
    }

    const toolGrid = document.getElementById('tool-grid');
    if (toolGrid) {
        const toolHtml = siteConfig.tools.map(tool => `
            <a href="${basePath}${tool.url}" class="group bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-2xl hover:border-blue-200 transition-all duration-300 transform hover:-translate-y-1">
                <div class="flex items-start justify-between mb-6">
                    <div class="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-3xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">${tool.icon}</div>
                    ${tool.isUpdate ? '<span class="text-[10px] font-bold text-blue-500 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">Update</span>' : ''}
                </div>
                <h3 class="text-xl font-bold mb-3 group-hover:text-blue-600 transition-colors">${tool.name}</h3>
                <p class="text-sm text-gray-500 leading-relaxed">${tool.description}</p>
                <div class="mt-6 flex items-center text-blue-600 font-bold text-sm"><span>使ってみる</span><span class="ml-2 group-hover:ml-4 transition-all">→</span></div>
            </a>
        `).join('');
        toolGrid.innerHTML = toolHtml + `<div class="bg-gray-50 p-8 rounded-3xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 text-center"><p class="text-sm font-bold tracking-widest">COMING SOON</p></div>`;
    }

    const f = document.getElementById('common-footer');
    if (f) f.innerHTML = `<footer class="bg-white border-t mt-12 py-8 text-center text-sm text-gray-400">${siteConfig.footerText}</footer>`;

    // 4. メニュー開閉ロジック
    const menuBtn = document.getElementById('menuBtn');
    const closeBtn = document.getElementById('closeBtn');
    const drawer = document.getElementById('menuDrawer');
    const overlay = document.getElementById('drawerOverlay');
    const content = document.getElementById('drawerContent');

    const toggleMenu = (open) => {
        if (open) {
            drawer.classList.remove('invisible');
            setTimeout(() => { overlay.classList.add('opacity-50'); overlay.classList.remove('opacity-0'); content.classList.remove('-translate-x-full'); }, 10);
        } else {
            overlay.classList.replace('opacity-50', 'opacity-0');
            content.classList.add('-translate-x-full');
            setTimeout(() => drawer.classList.add('invisible'), 300);
        }
    };
    menuBtn?.addEventListener('click', () => toggleMenu(true));
    closeBtn?.addEventListener('click', () => toggleMenu(false));
    overlay?.addEventListener('click', () => toggleMenu(false));

    // お知らせエリア開閉ロジック (index.html用)
    const newsContainer = document.getElementById('news-container');
    const toggleNewsBtn = document.getElementById('toggle-news-btn');
    if (toggleNewsBtn && newsContainer) {
        let isNewsOpen = false;
        toggleNewsBtn.addEventListener('click', () => {
            isNewsOpen = !isNewsOpen;
            newsContainer.style.height = isNewsOpen ? '180px' : '32px';
            newsContainer.style.overflowY = isNewsOpen ? 'auto' : 'hidden';
            if (!isNewsOpen) newsContainer.scrollTop = 0;
            document.getElementById('toggle-text').textContent = isNewsOpen ? '閉じる' : 'アップデート内容を表示';
            document.getElementById('toggle-icon').style.transform = isNewsOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        });
    }
}

initCommonComponents();
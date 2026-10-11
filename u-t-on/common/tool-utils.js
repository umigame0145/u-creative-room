/* Shared helpers for browser-local tools. No input is sent to a server. */
window.ToolUtils = {
    escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    },
    readJSON(key, fallback) {
        try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
        catch { return fallback; }
    },
    writeJSON(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); return true; }
        catch { this.notify('このブラウザでは保存できません。必要なデータはCSVで保存してください。'); return false; }
    },
    notify(message) {
        let area = document.getElementById('tool-notice');
        if (!area) {
            area = document.createElement('div');
            area.id = 'tool-notice';
            area.setAttribute('role', 'status');
            area.setAttribute('aria-live', 'polite');
            document.body.appendChild(area);
        }
        area.textContent = message;
        clearTimeout(this.noticeTimer);
        this.noticeTimer = setTimeout(() => { area.textContent = ''; }, 6000);
    },
    parseCSV(text) {
        text = String(text).replace(/^\uFEFF/, '');
        const rows = [];
        let row = [], field = '', quoted = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i], next = text[i + 1];
            if (quoted) {
                if (c === '"' && next === '"') { field += '"'; i++; }
                else if (c === '"') quoted = false;
                else field += c;
            } else if (c === '"' && field === '') quoted = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\r' || c === '\n') {
                if (c === '\r' && next === '\n') i++;
                row.push(field); rows.push(row); row = []; field = '';
            } else field += c;
        }
        if (quoted) throw new Error('CSVの引用符が閉じられていません。');
        if (field || row.length) { row.push(field); rows.push(row); }
        return rows;
    },
    csvField(value) { return '"' + String(value ?? '').replace(/"/g, '""') + '"'; },
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = filename;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    async copyText(text) {
        try { await navigator.clipboard.writeText(text); }
        catch {
            const focused = document.activeElement;
            const area = document.createElement('textarea');
            area.value = text; area.style.cssText = 'position:fixed;left:-9999px;top:0';
            document.body.appendChild(area); area.select();
            const copied = document.execCommand('copy');
            area.remove(); focused?.focus();
            if (!copied) throw new Error('コピーできませんでした。');
        }
    },
    async decodeImage(file) {
        let source = file;
        if (/\.hei[cf]$/i.test(file.name)) {
            if (typeof heic2any === 'undefined') throw new Error('HEICの変換機能を読み込めません。PNGかJPEGに変換してお試しください。');
            source = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
            if (Array.isArray(source)) source = source[0];
        }
        const url = URL.createObjectURL(source);
        try {
            const image = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('画像を読み込めません。PNG・JPEG・WebPをお試しください。'));
                img.src = url;
            });
            return { image, file: source, url };
        } catch (error) { URL.revokeObjectURL(url); throw error; }
    }
};

/**
 * koko-ni-mosaic.js
 * 画像の任意の場所にモザイクをかけるツール
 */

class KokoNiMosaic {
    constructor() {
        this.canvas = document.getElementById('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.imageInput = document.getElementById('imageInput');
        this.dropArea = document.getElementById('dropArea');
        this.emptyState = document.getElementById('emptyState');

        // Settings UI
        this.shapeSquareBtn = document.getElementById('shapeSquareBtn');
        this.shapeCircleBtn = document.getElementById('shapeCircleBtn');
        this.squareSettings = document.getElementById('squareSettings');
        this.circleSettings = document.getElementById('circleSettings');
        this.mosaicWidth = document.getElementById('mosaicWidth');
        this.mosaicWidthSlider = document.getElementById('mosaicWidthSlider');
        this.mosaicHeight = document.getElementById('mosaicHeight');
        this.mosaicHeightSlider = document.getElementById('mosaicHeightSlider');
        this.mosaicRotate = document.getElementById('mosaicRotate');
        this.mosaicRotateSlider = document.getElementById('mosaicRotateSlider');
        this.mosaicSize = document.getElementById('mosaicSize');
        this.mosaicSizeSlider = document.getElementById('mosaicSizeSlider');
        this.pixelSizeInput = document.getElementById('pixelSize');
        this.pixelSizeValue = document.getElementById('pixelSizeValue');
        this.invertColorsInput = document.getElementById('invertColors');
        this.applyBtn = document.getElementById('applyBtn');
        this.undoBtn = document.getElementById('undoBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.persistentUploadBtn = document.getElementById('persistentUploadBtn');
        this.statusMessage = document.getElementById('statusMessage');

        // Fine-tuning buttons
        this.moveUpBtn = document.getElementById('moveUpBtn');
        this.moveDownBtn = document.getElementById('moveDownBtn');
        this.moveLeftBtn = document.getElementById('moveLeftBtn');
        this.moveRightBtn = document.getElementById('moveRightBtn');

        // State
        this.originalImage = null;
        this.currentShape = 'square'; // 'square' or 'circle'
        this.appliedMosaics = []; // { shape, x, y, width, height, rotate, pixelSize }
        this.previewMosaic = null; // Current mouse position { x, y }
        this.isImageLoaded = false;

        this.init();
    }

    init() {
        // Event Listeners
        this.imageInput.addEventListener('change', (e) => this.handleImageUpload(e.target.files[0]));

        this.dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropArea.classList.add('drag-over');
        });
        this.dropArea.addEventListener('dragleave', () => this.dropArea.classList.remove('drag-over'));
        this.dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropArea.classList.remove('drag-over');
            this.handleImageUpload(e.dataTransfer.files[0]);
        });

        document.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.indexOf('image') !== -1) {
                    this.handleImageUpload(item.getAsFile());
                }
            }
        });

        // UI Interaction
        this.shapeSquareBtn.addEventListener('click', () => this.setShape('square'));
        this.shapeCircleBtn.addEventListener('click', () => this.setShape('circle'));

        this.mosaicRotateSlider.addEventListener('input', (e) => {
            this.mosaicRotate.value = e.target.value;
            this.draw();
        });
        this.mosaicRotate.addEventListener('input', (e) => {
            this.mosaicRotateSlider.value = e.target.value;
            this.draw();
        });
        this.pixelSizeInput.addEventListener('input', () => {
            this.pixelSizeValue.textContent = this.pixelSizeInput.value;
            this.draw();
        });

        this.invertColorsInput.addEventListener('change', () => this.draw());

        // Bidirectional synchronization
        const syncPairs = [
            { num: this.mosaicWidth, range: this.mosaicWidthSlider },
            { num: this.mosaicHeight, range: this.mosaicHeightSlider },
            { num: this.mosaicSize, range: this.mosaicSizeSlider },
            { num: this.mosaicRotate, range: this.mosaicRotateSlider }
        ];

        syncPairs.forEach(pair => {
            pair.num.addEventListener('input', (e) => {
                pair.range.value = e.target.value;
                this.draw();
            });
            pair.range.addEventListener('input', (e) => {
                pair.num.value = e.target.value;
                this.draw();
            });
        });

        this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.canvas.addEventListener('pointerleave', () => {
            // this.previewMosaic = null; // 不要：固定するため
            this.draw();
        });

        // Touch handling (optional but good for specific behaviors)
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePointerDown(e.touches[0]);
        }, { passive: false });

        this.applyBtn.addEventListener('click', () => this.applyMosaic());
        this.undoBtn.addEventListener('click', () => this.undo());
        this.clearBtn.addEventListener('click', () => this.clearAll());
        this.downloadBtn.addEventListener('click', () => this.download());
        this.persistentUploadBtn.addEventListener('click', () => this.imageInput.click());

        // Fine-tuning
        this.moveUpBtn.addEventListener('click', () => this.movePreview(0, -1));
        this.moveDownBtn.addEventListener('click', () => this.movePreview(0, 1));
        this.moveLeftBtn.addEventListener('click', () => this.movePreview(-1, 0));
        this.moveRightBtn.addEventListener('click', () => this.movePreview(1, 0));

        window.addEventListener('keydown', (e) => {
            if (!this.isImageLoaded || !this.previewMosaic) return;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const dx = e.key === 'ArrowLeft' ? -1 : (e.key === 'ArrowRight' ? 1 : 0);
                const dy = e.key === 'ArrowUp' ? -1 : (e.key === 'ArrowDown' ? 1 : 0);
                this.movePreview(dx, dy);
            }
        });
    }

    movePreview(dx, dy) {
        if (!this.previewMosaic) return;
        this.previewMosaic.x += dx;
        this.previewMosaic.y += dy;
        this.draw();
    }

    setShape(shape) {
        this.currentShape = shape;
        if (shape === 'square') {
            this.shapeSquareBtn.classList.replace('tool-btn-inactive', 'tool-btn-active');
            this.shapeCircleBtn.classList.replace('tool-btn-active', 'tool-btn-inactive');
            this.squareSettings.classList.remove('hidden');
            this.circleSettings.classList.add('hidden');
        } else {
            this.shapeSquareBtn.classList.replace('tool-btn-active', 'tool-btn-inactive');
            this.shapeCircleBtn.classList.replace('tool-btn-inactive', 'tool-btn-active');
            this.squareSettings.classList.add('hidden');
            this.circleSettings.classList.remove('hidden');
        }
        this.draw();
    }

    handleImageUpload(file) {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.canvas.width = img.width;
                this.canvas.height = img.height;
                this.canvas.classList.remove('hidden');
                this.emptyState.classList.add('hidden');
                this.isImageLoaded = true;
                this.appliedMosaics = [];

                // Set max values for dimensions
                const maxDim = Math.max(img.width, img.height);
                this.mosaicWidth.max = img.width;
                this.mosaicWidthSlider.max = img.width;
                this.mosaicHeight.max = img.height;
                this.mosaicHeightSlider.max = img.height;
                this.mosaicSize.max = maxDim;
                this.mosaicSizeSlider.max = maxDim;

                this.enableUI();
                this.draw();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    enableUI() {
        this.applyBtn.disabled = false;
        this.clearBtn.disabled = false;
        this.downloadBtn.disabled = false;
        this.statusMessage.textContent = '画像上をクリックしてモザイク範囲を指定してください';
    }

    handlePointerMove(e) {
        // 固定するため、マウス移動では位置を更新しない
        // if (!this.isImageLoaded) return;
        // const pos = this.getMousePos(e);
        // this.previewMosaic = pos;
        // this.draw();
    }

    handlePointerDown(e) {
        if (!this.isImageLoaded) return;
        const pos = this.getMousePos(e);
        this.previewMosaic = pos;
        this.draw();
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    draw() {
        if (!this.isImageLoaded) return;

        // 1. オフ画面バッファを使用して、UI要素（プレビュー枠など）を含まない「純粋な画像」を描画
        const bufferCanvas = document.createElement('canvas');
        bufferCanvas.width = this.canvas.width;
        bufferCanvas.height = this.canvas.height;
        const bCtx = bufferCanvas.getContext('2d');

        // 元画像を描画
        bCtx.drawImage(this.originalImage, 0, 0);

        // 2. 確定済みモザイクをバッファに対して適用
        this.appliedMosaics.forEach(m => this.renderMosaic(bCtx, m, false));

        // 3. メインキャンバスにバッファの内容をコピー
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(bufferCanvas, 0, 0);

        // 4. プレビューの描画（バッファを参照してモザイクを描画 + 枠線）
        if (this.previewMosaic) {
            const m = this.getCurrentMosaicConfig(this.previewMosaic);
            // プレビューのモザイク部分は bufferCanvas (確定済みまでの画像) からサンプリング
            this.renderMosaic(this.ctx, m, true, bufferCanvas);
        }

        this.undoBtn.disabled = this.appliedMosaics.length === 0;
    }

    getCurrentMosaicConfig(pos) {
        if (this.currentShape === 'square') {
            return {
                shape: 'square',
                x: pos.x,
                y: pos.y,
                width: parseInt(this.mosaicWidth.value) || 10,
                height: parseInt(this.mosaicHeight.value) || 10,
                rotate: parseInt(this.mosaicRotate.value) || 0,
                pixelSize: parseInt(this.pixelSizeInput.value) || 10,
                invert: this.invertColorsInput.checked
            };
        } else {
            return {
                shape: 'circle',
                x: pos.x,
                y: pos.y,
                size: parseInt(this.mosaicSize.value) || 10,
                pixelSize: parseInt(this.pixelSizeInput.value) || 10,
                invert: this.invertColorsInput.checked
            };
        }
    }

    /**
     * @param {CanvasRenderingContext2D} targetCtx 描画先
     * @param {Object} m 設定
     * @param {Boolean} isPreview プレビュー表示か
     * @param {HTMLCanvasElement} sourceCanvas サンプリング元（プレビュー時用）
     */
    renderMosaic(targetCtx, m, isPreview, sourceCanvas) {
        targetCtx.save();

        if (m.shape === 'square') {
            targetCtx.translate(m.x, m.y);
            targetCtx.rotate(m.rotate * Math.PI / 180);
            targetCtx.beginPath();
            targetCtx.rect(0, 0, m.width, m.height);
        } else {
            targetCtx.beginPath();
            targetCtx.arc(m.x, m.y, m.size / 2, 0, Math.PI * 2);
        }

        // クリップ設定
        targetCtx.clip();

        // モザイク処理の実体
        if (m.shape === 'square') {
            this.applyPixelation(targetCtx, 0, 0, m.width, m.height, m.pixelSize, sourceCanvas, m.x, m.y, m.rotate, m.invert);
        } else {
            this.applyPixelation(targetCtx, m.x - m.size / 2, m.y - m.size / 2, m.size, m.size, m.pixelSize, sourceCanvas, undefined, undefined, undefined, m.invert);
        }

        targetCtx.restore();

        // 枠線とオーバーレイはクリップの外に描画（プレビュー時のみ）
        if (isPreview) {
            targetCtx.save();
            if (m.shape === 'square') {
                targetCtx.translate(m.x, m.y);
                targetCtx.rotate(m.rotate * Math.PI / 180);
                targetCtx.strokeStyle = '#3b82f6';
                targetCtx.lineWidth = 2;
                targetCtx.strokeRect(0, 0, m.width, m.height);
            } else {
                targetCtx.beginPath();
                targetCtx.arc(m.x, m.y, m.size / 2, 0, Math.PI * 2);
                targetCtx.strokeStyle = '#3b82f6';
                targetCtx.lineWidth = 2;
                targetCtx.stroke();
            }
            targetCtx.restore();
        }
    }

    /**
     * @param {CanvasRenderingContext2D} targetCtx 描画先コンテキスト
     * @param {HTMLCanvasElement} sourceImage サンプリング元
     */
    applyPixelation(targetCtx, x, y, w, h, pixelSize, sourceImage, mX, mY, rotate, invert) {
        const sw = Math.ceil(w / pixelSize);
        const sh = Math.ceil(h / pixelSize);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = sw;
        offCanvas.height = sh;
        const offCtx = offCanvas.getContext('2d');
        offCtx.imageSmoothingEnabled = false;

        // サンプリング元が指定されていない場合は targetCtx の canvas 自体を使用（確定描画時）
        const src = sourceImage || targetCtx.canvas;

        if (rotate !== undefined) {
            // 回転している場合、サンプリング元(src)の適切な位置から取り出す
            // offCtx.scale(1/pixelSize, 1/pixelSize) 的な効果
            // src は（preview時なら）UIを含まない bufferCanvas なので安全
            offCtx.save();
            offCtx.scale(sw / w, sh / h);
            offCtx.translate(-mX, -mY); // 元のCanvas座標系に合わせる
            // 回転を考慮した逆変換は不要。renderMosaicでtranslate/rotateされているtargetCtxに対して描画するので、
            // 「正面向いたw, h」をoffCanvasで作ればよい。
            // しかしサンプリング元は正面向いていない元のCanvas。

            // 確実な方法：一旦正面向いた temp を作る
            const temp = document.createElement('canvas');
            temp.width = w;
            temp.height = h;
            const tCtx = temp.getContext('2d');
            tCtx.translate(-mX, -mY); // サンプリング元の位置
            // ...これは難しい。
            // シンプルに：
            // 1. サンプリング元の位置(mX, mY)から十分に大きい範囲を抜き出し、逆回転させて temp(w, h) に収める
            tCtx.setTransform(1, 0, 0, 1, 0, 0);
            tCtx.translate(0, 0);
            // 代わりに offCtx でサンプリングする際に逆変換をかける
            offCtx.setTransform(sw / w, 0, 0, sh / h, 0, 0);
            offCtx.rotate(-rotate * Math.PI / 180);
            offCtx.translate(-mX, -mY);
            offCtx.drawImage(src, 0, 0);
            offCtx.restore();
        } else {
            offCtx.drawImage(src, x, y, w, h, 0, 0, sw, sh);
        }

        targetCtx.save();
        targetCtx.imageSmoothingEnabled = false;
        if (invert) {
            targetCtx.filter = 'invert(100%)';
        }
        targetCtx.drawImage(offCanvas, 0, 0, sw, sh, x, y, w, h);
        targetCtx.restore();
    }

    applyMosaic() {
        if (!this.previewMosaic) return;
        const config = this.getCurrentMosaicConfig(this.previewMosaic);
        this.appliedMosaics.push(config);

        // プレビューを消さずに描画を更新
        this.draw();

        this.statusMessage.textContent = '確定しました。さらに追加できます。';

        // 触感フィードバック的なアニメーション（任意）
        this.applyBtn.classList.add('bg-green-600');
        setTimeout(() => this.applyBtn.classList.remove('bg-green-600'), 200);
    }

    undo() {
        if (this.appliedMosaics.length > 0) {
            this.appliedMosaics.pop();
            this.draw();
        }
    }

    clearAll() {
        if (confirm('すべてのモザイクを消去して元に戻しますか？')) {
            this.appliedMosaics = [];
            this.draw();
        }
    }

    download() {
        const format = document.querySelector('input[name="format"]:checked').value;
        const extension = format === 'image/png' ? 'png' : 'jpg';

        // プレビュー枠が入らないように、プレビューを消して再描画
        const tempPreview = this.previewMosaic;
        this.previewMosaic = null;
        this.draw();

        const link = document.createElement('a');
        link.download = `koko-ni-mosaic-${Date.now()}.${extension}`;
        link.href = this.canvas.toDataURL(format, 0.9);
        link.click();

        // プレビューを戻す
        this.previewMosaic = tempPreview;
        this.draw();
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    new KokoNiMosaic();
});

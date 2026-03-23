/**
 * suke-touka.js
 * 画像の任意の場所を透明にするツール
 */

class SukeTouka {
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
        
        this.opacityInput = document.getElementById('transparencyOpacity');
        this.opacityValueLabel = document.getElementById('opacityValue');

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
        this.appliedTransparencies = []; // { shape, x, y, width, height, rotate, opacity }
        this.previewPos = null; // Current mouse position { x, y }
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

        this.opacityInput.addEventListener('input', (e) => {
            this.opacityValueLabel.textContent = `${e.target.value}%`;
            this.draw();
        });

        // Bidirectional synchronization for size inputs
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

        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        
        this.applyBtn.addEventListener('click', () => this.applyTransparency());
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
            if (!this.isImageLoaded || !this.previewPos) return;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const dx = e.key === 'ArrowLeft' ? -1 : (e.key === 'ArrowRight' ? 1 : 0);
                const dy = e.key === 'ArrowUp' ? -1 : (e.key === 'ArrowDown' ? 1 : 0);
                this.movePreview(dx, dy);
            }
        });
    }

    movePreview(dx, dy) {
        if (!this.previewPos) return;
        this.previewPos.x += dx;
        this.previewPos.y += dy;
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
                this.appliedTransparencies = [];
                this.previewPos = null;

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
        this.statusMessage.textContent = '画像上をクリックして透過範囲を指定してください';
    }

    handlePointerDown(e) {
        if (!this.isImageLoaded) return;
        this.previewPos = this.getMousePos(e);
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

        const bufferCanvas = document.createElement('canvas');
        bufferCanvas.width = this.canvas.width;
        bufferCanvas.height = this.canvas.height;
        const bCtx = bufferCanvas.getContext('2d');

        // 1. Draw original image
        bCtx.drawImage(this.originalImage, 0, 0);

        // 2. Apply confirmed transparencies
        this.appliedTransparencies.forEach(t => this.renderTransparency(bCtx, t, false));

        // 3. Clear main canvas and draw buffer
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(bufferCanvas, 0, 0);

        // 4. Draw preview transparency and border
        if (this.previewPos) {
            const config = this.getCurrentConfig(this.previewPos);
            this.renderTransparency(this.ctx, config, true);
        }

        this.undoBtn.disabled = this.appliedTransparencies.length === 0;
    }

    getCurrentConfig(pos) {
        if (this.currentShape === 'square') {
            return {
                shape: 'square',
                x: pos.x,
                y: pos.y,
                width: parseInt(this.mosaicWidth.value) || 10,
                height: parseInt(this.mosaicHeight.value) || 10,
                rotate: parseInt(this.mosaicRotate.value) || 0,
                opacity: parseInt(this.opacityInput.value) / 100
            };
        } else {
            return {
                shape: 'circle',
                x: pos.x,
                y: pos.y,
                size: parseInt(this.mosaicSize.value) || 10,
                opacity: parseInt(this.opacityInput.value) / 100
            };
        }
    }

    renderTransparency(targetCtx, t, isPreview) {
        targetCtx.save();

        // プレビュー枠線以外の「中身（透過処理）」を描画
        // destination-out を使って背景を消す
        targetCtx.globalCompositeOperation = 'destination-out';
        targetCtx.globalAlpha = t.opacity;

        targetCtx.beginPath();
        if (t.shape === 'square') {
            targetCtx.translate(t.x, t.y);
            targetCtx.rotate(t.rotate * Math.PI / 180);
            targetCtx.rect(0, 0, t.width, t.height);
        } else {
            targetCtx.arc(t.x, t.y, t.size / 2, 0, Math.PI * 2);
        }
        targetCtx.fill();

        targetCtx.restore();

        // プレビュー用の枠線
        if (isPreview) {
            targetCtx.save();
            targetCtx.strokeStyle = '#3b82f6';
            targetCtx.lineWidth = 2;
            targetCtx.beginPath();
            if (t.shape === 'square') {
                targetCtx.translate(t.x, t.y);
                targetCtx.rotate(t.rotate * Math.PI / 180);
                targetCtx.strokeRect(0, 0, t.width, t.height);
            } else {
                targetCtx.arc(t.x, t.y, t.size / 2, 0, Math.PI * 2);
                targetCtx.stroke();
            }
            targetCtx.restore();
        }
    }

    applyTransparency() {
        if (!this.previewPos) return;
        const config = this.getCurrentConfig(this.previewPos);
        this.appliedTransparencies.push(config);

        this.draw();
        this.statusMessage.textContent = '透過を適用しました。';

        this.applyBtn.classList.add('bg-green-600');
        setTimeout(() => this.applyBtn.classList.remove('bg-green-600'), 200);
    }

    undo() {
        if (this.appliedTransparencies.length > 0) {
            this.appliedTransparencies.pop();
            this.draw();
        }
    }

    clearAll() {
        if (confirm('すべての透過設定を解除して元に戻しますか？')) {
            this.appliedTransparencies = [];
            this.draw();
        }
    }

    download() {
        const formatSelect = document.querySelector('input[name="format"]:checked');
        const format = formatSelect ? formatSelect.value : 'image/png';
        const extension = format === 'image/png' ? 'png' : 'jpg';

        // Disable preview for capture
        const tempPreview = this.previewPos;
        this.previewPos = null;
        this.draw();

        const link = document.createElement('a');
        link.download = `suke-touka-${Date.now()}.${extension}`;
        link.href = this.canvas.toDataURL(format, 0.9);
        link.click();

        // Restore preview
        this.previewPos = tempPreview;
        this.draw();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new SukeTouka();
});

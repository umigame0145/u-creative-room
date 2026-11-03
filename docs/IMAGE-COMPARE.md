# 画像比較

実装日：2026-11-04。ページ：`u-t-on/tools/image-compare.html`。以下は公開前の実装・検証記録。

## 機能と計算

- 静止画PNG・JPEG・WebPをA/B各1枚入力。端末内で解析し、ファイルをサーバーに送信しない。
- A/Bを左上で合わせる。寸法が異なる場合も引き伸ばして合わせない。片方だけにある画素は必ず差分。両方に画像がない余白は分母から除外する。
- 白背景に合成したRGBのいずれかのチャンネル差が許容値より大きい画素を数える。差分率＝差分画素数÷比較対象画素数×100。許容値初期0、UIは0〜80。0〜255はコアで扱える。
- 透明部分に隠れたRGBとメタデータは比較しない。透明黒と不透明白は白背景上で同じ見た目なので差分0。
- 分母は `aw*ah + bw*bh - min(aw,bw)*min(ah,bh)` と等価。異サイズの白16×8と8×16は比較対象192画素・差分128画素＝66.67%。
- 差分画素だけにRGB(235,55,65)を初期30%で重ねる。濃さ10〜70%は表示・保存だけに作用し、差分率を変えない。背景はB。
- 「差分だけ表示（元画像を隠す）」をオンにすると、元の色を使わない赤の透明レイヤーだけを白背景上で表示。PNG保存は差分以外が透明（30%時は差分のalpha=77）のimage-diff-layer.png。A/B表示を選ぶとチェックを解除する。オン/オフで率は変わらない。
- A/B/差分の切り替え、比較画像の原寸スクロール、赤い差分PNG保存。表示がA/Bでも保存は赤い差分画像。小さな非ゼロ差分は0.00%とせず「< 0.01%」と表示。
- 許容値の変更、入力の変更、消去で古い結果を無効化。中止・失敗した比較は途中の率を表示しない。

## リソースと注意

- 1枚30MiB・2400万画素まで。比較矩形は400万画素・長辺3000px以内に、共通倍率で縮小する。縮小後の率であることを比較前後に明記する。元サイズでの厳密な全画素比較を大きな画像で保証しない。
- 画像を1枚ずつ復元し、描画後にImageBitmap.close()。保持するのはFile、320px以内のサムネイルURL、比較RGBAバッファ2本と差分マスク。描画用の一時canvasは縮小して解放する。
- 比較は64行ごとに制御を返し、中止を確認。アップロード中・比較中・保存中は入力操作を固定。サムネイルURLと比較バッファを入力置換・消去・pagehideで解放。
- アニメーションの全フレーム比較、HDR/印刷色の厳密検査、内容の意味や位置合わせの自動判定は対象外。

## サンプルと検証

- `compare-a.png` / `compare-b.png` は内蔵image_genで生成・編集した猫のいる作業部屋のイラスト1536×1024。Bではマグカップと本の色を変更。生成編集では背景等にも微小な色の揺らぎがあるため、サンプルボタンで許容値20を設定し、そのことを画面と説明に明示。実ブラウザで49,220/1,572,864画素＝3.13%を確認。許容値0は99.83%。2箇所以外が厳密に同一画素とは説明しない。
- `compare-diff.png` はページの保存ボタンから取得した実出力。NumPy/Pillowで許容値20の差分マスク49,220画素だけに赤30%が適用され、他の画素がBと完全一致することを独立検証した。コアテストの10%ケースは、別途生成する合成ピクセルデータで維持。
- 実ブラウザで異サイズ白画像66.67%、透明黒と不透明白0%、3200×2000の縮小比較2529×1581・10.02%と縮小注意表示、壊れた画像への日本語エラーを確認。
- 初期図解版で、A表示中の保存PNGも差分表示中に保存したPNGと全画素一致、赤の濃さ30→35%でも差分率が変わらないことを確認済み。イラスト差し替え後も既存の表示・保存ロジックは同一。
- 実効ビューポート360px/1265pxで確認。360px時のページscrollWidth=clientWidth、原寸の横スクロールは画像枠内だけ（幅294px/内部816px）。iPhone/Android実機、Safari/Firefoxは未検証。
- 差分レイヤーの実保存PNGを独立検証し、差分49,220画素だけが赤・alpha77、それ以外は透明であることを確認。
- `npm test` 78件成功。画像比較のコア9件、UI4件を含む。`npm run check` 33ページ・スクリプトと全ローカルリンク成功。
- 共通メニュー/トップページ/検索・分類/サイトマップ/このサイトについてを更新。AdSenseタグと静的な使い方・計算方法・制約・実出力例を掲載。広告審査申請は機能の公開とは別に行う。

## 画像生成の記録

内蔵image_genを使用（CLI/APIフォールバックなし）。生成Aはexec-6d5c4e7e-79bc-40b1-a15c-cdf00defd264.png、編集Bはexec-f8817805-9bb7-4dc6-988c-f888e34fb103.pngから、上記common/examples/に無変更でコピーした。Bの編集対象は直前に生成したA。第三者の参照画像は使用していない。

生成プロンプト（原文）：

> Use case: illustration-story. Asset type: original paired sample A for an image-comparison website; a single finished illustration, landscape 3:2. Create a charming crisp flat-color editorial illustration of a little cat sitting at a tidy wooden desk beside a window, with a small potted plant, a yellow mug and a closed teal book. Spacious simple composition, warm cream background, teal and sage furnishings, soft terracotta accents. Clear shapes and restrained thick rounded outlines, plain solid color fills, no grain, no gradients, no complex textures. A friendly fully illustrated scene, not a diagram or UI. Leave objects clearly separated so that a later version can change a few objects. No words, numbers, labels, logos, watermarks, panel borders or comparison annotations. No split screen: one image only.

編集プロンプト（原文）：

> Use case: precise-object-edit. This is the edit target for sample B of an image-comparison tool. Make only these two small changes to the supplied illustration: change the yellow mug on the desk to coral red; change the teal cover of the closed book on the desk to pale sky blue. Preserve the mug and book shapes, dark outlines, highlights, positions and shadows exactly. Preserve every other pixel of the illustration, including the cat, room, window, curtains, plants, furniture and cream background. Same canvas size and framing. Do not redraw, reinterpret, recolor, sharpen, crop or move anything else. No text, no numbers, no annotations. Return a single complete edited illustration.

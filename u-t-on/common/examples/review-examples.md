# P0-2 / P0-3 作例の生成記録

2026-11-11、Node v24.22.1 / JSDOM 26.1.0 / @napi-rs/canvas 0.1.80 で生成。
全素材は自作のダミー。「空野 サンプル」「架空の空色ホール」は架空の名前。
生成スクリプトは `scripts/generate-review-examples.mjs`。
実在の人物・写真・ユーザーの保存データ・外部サービスは使用しない。

## 再生成

リポジトリルートで、JSDOMとCanvasモジュール、日本語フォントを用意して実行する。
Canvasは通常のテスト・サイト実行には不要で、作例の再生成だけで使用する。

```sh
CANVAS_MODULE=/path/to/@napi-rs/canvas \
EXAMPLE_FONT=/path/to/NotoSerifCJK-Regular.ttc \
node scripts/generate-review-examples.mjs
npm test
npm run check
```

Canvasを通常のNodeモジュール探索パスに置いた場合、CANVAS_MODULEは省略可能。
EXAMPLE_FONTのデフォルトは `/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc`。
モジュール・フォント・エンコーダの違いによって画像のバイト列や文字の描画は変わり得る。
生成先の同名作例ファイルは上書きするが、ユーザーのブラウザやストレージには接続しない。

## 入力・処理・成果物

- `mosaic-input.png`：480×180のダミー名札。Canvasで入力を作成。氏名32px。
- `mosaic-{2,10,30}.png`：既存KokoNiMosaicの確定描画とdownloadを実行。
  四角、左上(24,56)、幅300、高さ56、回転0、粒度2/10/30、反転なし。
- `touka-{0,50,100}.png`：同じ入力・範囲、SukeToukaの確定描画とdownloadを実行。
  各透過度は元画像から独立に1回だけ適用。範囲内alphaが255/約128/0であることを検証。
- `touka-{0,50,100}-background.png`：上記のPNG出力をCanvasで背景#65b8d0に合成。
  合成機能はツール本体にはなく、確認用スクリプトのみ。
- `touka-100.jpg`：透過度100%、既存downloadの白背景合成とJPEG品質0.9で保存。
- `copy-pattan.csv`：素材3件を「追加」、作成エリアに改行を入力、ストック1件に保存し、既存CSV保存ボタンを実行。
- `counter-traffic.csv`：車12・自転車3・歩行者5、車両グループに車と自転車を登録し既存exportCSVを実行。
- `counter-zero.csv`：同じ項目・グループで全カウント0。exportCSVを実行。
- `roulette-ratio.csv`：景品A=2・B=1の初期設定をexportCSVで保存。
- `roulette-percent.csv`：景品A=60・B=40の初期設定をexportCSVで保存。
- `*-screen.png`、`roulette-*-{before,after}.png`：既存JSの描画・SET処理後の表示値を抜粋した図。
  ブラウザのスクリーンショットではない。配置は説明用で、ページにもその旨を記載。
  ルーレットはAの当選を指定した状態遷移例であり、ランダム抽選結果の統計ではない。
  比率のSETでAが2→1、％のSETでAが対象外になることを検証。

JSDOMのCanvas APIを@napi-rs/canvasに接続し、ツール本体のJSファイルをそのまま実行する。
モザイク・透過・CSVのアルゴリズムは生成スクリプトに複製していない。
Canvas 0.1.80のdestination-outがalphaを二重適用する挙動を独立した2×2pxの試験で検出する。
該当時のみCanvas接続部のfillでalphaを補正し、ツール本体の処理は変更しない。
保存PNGを再読込し、範囲内alpha（255/約128/0）と範囲外の不透明を検証する。
JPEGも再読込し、透明範囲が白背景になることを検証する。
CSVはToolUtilsの保護ヘッダーを含む実出力で、手書きの疑似CSVではない。
回帰テストでは公開CSVの読込、改行・ストック・グループ復元、上書きキャンセル、異種CSVエラー、SET処理を確認する。

## 制約

この環境ではChrome起動が権限制限で失敗したため、ブラウザでのレイアウト検証は未実施。
ブラウザとNode Canvasのフォント・色管理・エンコード差はあり得る。
モザイクの粒度や文字サイズ、透過度を情報秘匿の安全基準として扱わない。
CSV読込はユーザーの確認後に既存データを置換する既存機能を使用し、自動サンプル読込は追加していない。
ルーレットCSVにはモード・履歴・減算残数が入らず、再読込で現在の重みは初期化される。

# P0-4 記事作例（2026-11-12）

`python3 scripts/generate-article-examples.py` で追加素材を生成。
Python 3 / Pillow 13.0.0（libjpeg 6.2、libwebp 1.6.0）、FFmpeg 7.1.5。
DejaVuSans.ttfを使用。再生成は同名ファイルを上書きする。
日本語名「空野 サンプル」と英字 Sorano Sample は架空の名前。全画面・動画は自作ダミー。
モザイク記事は上記P0-2で本体JSから生成済みの名札・粒度2/10/30を使用する。
文字高さは再現条件であり、安全基準ではない。

- `format-source.png`：640×360 RGBA。透明外周、文字、1px線、グラデーション。
- `format-q75.jpg`：同じ画素を白背景へ合成し品質75、4:2:0、optimizeなしで1回保存。
- `format-q75.webp`：同じRGBAを非可逆品質75、method 6で1回保存。
- `format-*.{png,jpg,webp}-zoom.png`：(24,28)から320×64pxを切り出し最近傍で3倍。圧縮画像を再読込して作成。
- `format-*.{png,jpg,webp}-background.png`：各実出力を再読込して#65b8d0へ合成。外周alphaをassert。
- `article-measurements.json`：実ファイルのバイト数、エンコーダのバージョン。
  この素材はPNG 9,197 / JPEG 18,500 / WebP 4,632バイト。
  エンコーダやフォントが変われば容量も変わり、異形式の品質75は同じ画質ではない。
- `workflow-{1,2}-input.png`：架空の問い合わせの選択画面・保存完了画面、各640×360。
- `workflow-{1,2}-redacted.png`：上部80pxを不透明な画素で置換した別ファイル。
- `workflow-joined.png`：秘匿済みだけを01→02の順で無拡縮縦結合、640×720。
- `workflow.pdf`：同じ秘匿済み素材のみ、A4相当1240×1754px・150ppi、余白約10mm・中央、2ページ。
  Pillowの参照出力で、サイト本体のPDF出力ではない。実送信や受信確認は行っていない。
- `timing-{cfr,vfr}.mp4`：同じ320×180px・12枚の連番ダミーをH.264 / yuv420p / Bフレーム0で保存。
  時間基準1/1000、CFR setpts=N*100、VFR setpts=if(lt(N,6),N*100,600+(N-6)*200)。
- `timing-{cfr,vfr}.csv`：ffprobe -show_packets -select_streams v:0 の実PTSとdurationを取得。
  Bフレームなしなのでパケット順が表示順。サイト本体のCSVとは異なる列構成。
  12パケット、CFR隣接差0.1秒、VFR隣接差0.1/0.2秒をassertする。
  最終行の隣接差と取得できないdurationは空欄。デコーダが全12枚を表示した実測ではない。

差分記事の既存A/B、許容値20の49,220画素・3.13%、許容値0の99.83%、サイズ等は変更していない。
追加素材には既存の差分用イラストを流用していない。

一次資料は `bash scripts/verify-article-sources.sh` でcurl GET・転送追跡・証明書検証を実施。
2026-11-12の全8件の最終200を `article-sources-curl.txt` に記録。
公式仕様・公式文書、およびモザイク照合手法の実装者自身のリポジトリを参照。

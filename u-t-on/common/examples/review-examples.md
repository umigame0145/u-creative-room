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

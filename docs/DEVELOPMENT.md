# ローカル開発と公開

サイト本体は `u-t-on/` のHTML・JavaScript・CSSです。Node.jsはローカルのCSS生成とテストに使用します。公開先にNode.jsは不要です。

リポジトリのルートで実行します（PowerShellでは `npm.cmd` も利用できます）。

```powershell
npm ci
npm run build:css
npm run check
npm test
npm run preview
```

プレビューは `http://127.0.0.1:4173/` です。停止するには起動したターミナルでCtrl+Cを押してください。

ユーザーのnpmキャッシュに書き込めない環境では、作業フォルダ内のキャッシュを指定できます。

```powershell
npm ci --cache .qa/npm-cache
```

Tailwindのクラスを追加・変更した場合は `npm run build:css` を実行し、生成された `u-t-on/common/utilities.css` も公開します。通常の文章やJavaScriptの変更は、CSS生成を必要としません。

公開する内容は `u-t-on/` の中身です。`node_modules/`、`.qa/`、`tests/` はサイトの公開対象ではありません。公開先のルートに `index.html` と `ads.txt` が置かれる構成にしてください。既存のホスティング設定を勝手に変更する必要はありません。

`npm run check` はJavaScript構文、HTML見出し・canonical・重複ID、ローカルリンクなどを検査します。`npm test` はCSVやツールの主要な不具合の回帰テストを実行します。実機と本番の確認事項は [IMPROVEMENTS.md](IMPROVEMENTS.md) を参照してください。

`tests/regressions.test.cjs` では描画・音声・PDFライブラリの一部を代替実装にしているため、ブラウザで保存した画像・PDFの最終確認も行ってください。

## セキュリティ対応後のCSSビルド（2026-10-23）

Tailwind CSS 4.3.3 のNode APIと公式Scannerで一度だけビルドします。監視用CLIは使いません。旧ビルド経路のbracesと古いselector parserを依存ツリーから除外しています。設定の入口はstyles/tailwind.cssとscripts/build-css.mjsです。styles/legacy-reset.cssは既存ページのリセットを保つための互換CSSです。Tailwind v4の対応ブラウザ（Safari 16.4以降、Chrome 111以降、Firefox 128以降）を前提とします。

Cloudflareのヘッダー設定はu-t-on/_headers。HTTPからHTTPSへの強制転送はこのファイルではできず、ゾーンのSSL/TLS → Edge Certificates → Always Use HTTPSを有効にします。既存の証明書とHTTPS応答を確認してから設定し、HTTPの301/308・転送先・パスとクエリの維持を公開後に確認してください。

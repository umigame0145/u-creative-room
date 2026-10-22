# セキュリティ診断結果（2026-10-23）

対象：Uの創作部屋 https://u-t-on.com/、ローカル main / 81ef2d1。
方法：ソースレビュー、npm audit、公開12ページと限定した5パスの通常GET、HTTP応答・ヘッダー確認、ローカルjsdomでCSV出力確認、既存39テスト。公開先への攻撃ペイロード、過負荷、フォーム送信、データ書き換えは実施していない。サイトコードや公開設定は変更していない。

## 結論

今回の範囲で、外部から直ちにサーバーを乗っ取る脆弱性や秘密ファイル漏えいは確認していない。ただし安全保証ではない。以下の改善が必要。深刻度はこのサイトでの到達性・利用者操作を考慮した定性的な評価で、ライブラリ告知のCVSSとは区別する。

## 1. HTTPで本文を配信し、HTTPSへ誘導しない（中・最優先）

http://u-t-on.com/ を redirect:manual で取得すると200、Locationなし、実際のサイトHTMLが返る。HTTPSの12ページにもStrict-Transport-Securityなし。HTTPでアクセスした利用者は、通信経路上でHTMLやJavaScriptを改変される危険がある。端末内で処理する画像・文章も、改変されたJavaScriptには読み取られうる。

対策：Cloudflareの既存配信経路でHTTPをHTTPSに301/308転送。HTTPSでHSTSを段階的に設定し、全ページのHTTPS動作確認後に期間を延ばす。サブドメイン対応を確認せずincludeSubDomainsやpreloadを有効にしない。

## 2. CSV数式インジェクション（中・利用者操作が必要）

common/tool-utils.js の csvField は引用符の処理のみ。ローカルで csvField('=1+1') の戻り値が "=1+1" になることを確認。カウンター・ルーレット・コピペったんのCSV保存から利用者文字列がこの関数に渡る。CSVをExcel等で開くと、先頭の = + - @ 等が数式扱いされうる。外部由来のCSVや文章を取り込み、再出力・共有した場合に注意。Excel上での実行や情報流出は試していない。ブラウザ上でコードが実行される問題ではない。

対策：表計算向けの安全なエクスポートと、再取り込み用バックアップを区別。テキストセル指定のXLSXなども検討。単純な値書き換えはバックアップの復元内容を変えるため、仕様と往復テストが必要。

## 3. クリックジャッキング対策と防御用ヘッダー（低〜中）

確認した公開12ページで CSP、X-Frame-Options、X-Content-Type-Options、Referrer-Policy、Permissions-Policy、HSTS は未設定。第三者サイトのiframeへの埋め込みをレスポンスで制限していない。実際の攻撃用ページは公開していない。

対策：frame-ancestors 'self' または 'none' と X-Frame-Options、nosniff を追加。Referrer-Policyも明示。CSPは画像blob/data、Google広告・解析・問い合わせフォームを考慮し、Report-Onlyから検証。未設定だけでXSS成立を意味するわけではない。

## 4. 古いCDN版jsPDF（保守上の中・既知CVEの直接到達は未確認）

tools/img-binder-pdf.html:20 は jsPDF 2.5.1。npm管理外のため npm audit --omit=dev の0件には含まれない。公式に既知の脆弱性告知あり。

ただし本サイトは generatePDF で画像をブラウザでデコードしCanvasに描画、toDataURL('image/jpeg')で再生成してaddImageに渡す。未検証の任意URLやGIF/BMPをそのままjsPDFに渡していないため、告知の画像DoSをそのまま再現できると断定しない。Node版のファイル読み取り脆弱性はブラウザUMD版の本サイトには該当しない。PDFフォーム機能など未使用APIの告知も自動的にサイトの脆弱性扱いしない。

対策：公式の現行安定版と全公開アドバイザリを再確認して互換性を検証し更新。PDF実出力テストも必要。heic2any 0.0.4もCDN依存。固定CDNライブラリにSRIなし。自己ホストまたはSRIを検討。広告・解析の動的スクリプトには固定SRIを機械的に適用できない。

## 5. 開発依存の既知問題（開発環境の中、公開サイトへの直接影響は低い）

npm audit：high 5 / moderate 2 / critical 0、計7パッケージ。独立した7件のCVEではなく、伝播した依存関係も数えられている。
- braces：深くネストしたパターンによるスタック枯渇。chokidar / micromatch / fast-glob / tailwindcssにも伝播。
- postcss-selector-parser：セレクター解析のCPU消費。postcss-nested / tailwindcssにも伝播。

package.jsonの依存はdevDependenciesのみ。公開配信は静的ファイルであり、これらのNodeモジュールは訪問者のブラウザで実行されない。悪意のあるビルド入力を取り込む開発・CIで注意。npm audit --omit=dev は0件だが、CDNライブラリの安全証明ではない。

対策：修正済み間接依存へ更新し、未修正範囲は上流対応を確認。npm audit fix --forceを無条件に使わず、CSS生成結果の差分とテストを確認。

## 6. ファイル・画像サイズと件数の上限不足（低・端末側の可用性）

画像読み込み・巨大Canvas生成・CSV読み込みに統一した容量、ピクセル数、行数の上限がない。大量ファイルや巨大画像でタブが固まる可能性。既知CVEの有無と別の設計上の問題。メモリ枯渇を起こす実験はしていない。

対策：読み込み前の容量/件数上限、デコード後の縦横/総画素制限、出力Canvas総画素とCSV行数上限を設ける。履歴のメモリ使用量も考慮。

## 良好だった点

- 公開12ページすべてHTTPSで200応答。
- /.git/config、/.env、/package.json、/node_modules/ は404。不存在のテストURLも404。
- 主な利用者入力の表示はtextContent、value、escapeHTMLを使用。既存のルーレット・保存フレーズのHTML風文字列テストに合格。すべてのXSSパターンを網羅した保証ではない。
- CSV取り込みは構文処理・数値・色の検証、上書き確認を実施。
- ローカルプレビューは127.0.0.1に限定し、パスの配信ルート内チェックあり。
- 追跡中のテキストファイルの限定的な秘密鍵/AWS/GitHubトークンパターン検索では一致なし。Git履歴全体、管理画面の秘密情報は未検査。
- 公開HTML内で確認したtarget=_blankリンクにnoopenerの欠落なし。
- npm test 39件、npm run check 25件に合格。これはセキュリティの完全性を保証する指標ではない。

## 確認できていない範囲

Cloudflare・GitHubアカウントのMFA/権限/秘密情報、Workers実装の管理画面側設定、監査ログ、WAF設定、全TLSバージョン/暗号スイート、外部Google/CDNサービス内部、Git履歴全体の秘密情報、全ブラウザでの実ファイル攻撃、DDoS耐性。ログイン/サーバーDB/APIはリポジトリ内に見つからず、SQLインジェクションや認証セッションの診断対象は確認できなかった。

## 根拠・証跡

- .qa/security-public.json：公開HTTP応答・全12ページのヘッダー、CDN情報
- .qa/security-npm-audit.json / security-npm-prod.json
- .qa/security-tests.txt / security-check.txt
- https://community.owasp.org/attacks/CSV_Injection
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security
- https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Clickjacking
- https://github.com/parallax/jsPDF/security/advisories/GHSA-w532-jxjh-hjhj
- https://github.com/parallax/jsPDF/security/advisories/GHSA-f8cm-6447-x5h2
- https://github.com/parallax/jsPDF/security/advisories/GHSA-67pg-wm7f-q7fj
- https://github.com/advisories/GHSA-vfj7-8cjw-p6xm
- https://github.com/advisories/GHSA-rj75-hqrm-r3gf

証跡の.qaはgitignore対象。報告書はdocs内でありサイト公開ルートu-t-on外。今回コミット・プッシュは実施していない。

## 対応状況（2026-10-23、ローカル修正・未公開）

1. HTTPS強制転送：Cloudflare管理画面がログイン画面のため未変更。ユーザーへログインを依頼済み。u-t-on/_headersにHSTS max-age=86400を準備したが、初回HTTPの転送を代替しない。公開後のHTTP検証が必要。
2. CSV：全3ツールをserializeCSVに統一。全セルにテキスト用アポストロフィを付け、専用マーカー行により当サイトのparseCSVは元の文字列を復元。旧CSVはそのまま読み込む。表計算ソフトで再保存した後の保護は保証しない。CSVの冒頭に形式識別行が増え、外部の独自CSV処理との互換性には注意。
3. 防御用ヘッダー：_headersにDENY、nosniff、Referrer-Policy、Permissions-Policy、HSTS、CSP(frame-ancestors/object-src/base-uri/upgrade-insecure-requests)を用意。script-srcを制限する強いCSPは広告・解析の実測が必要なので未導入。現状のCSPをXSS対策の完全実装とは扱わない。
4. jsPDF：4.2.1へ更新して同一サイト内配信・MITライセンス同梱。SHA-384 integrityを設定。heic2anyにもintegrityを設定。npm公式レジストリのアドバイザリ照会で両バージョンの応答は空だった（将来の安全保証ではない）。実ブラウザでPNG読み込み→Canvas→JPEG→PDFダウンロード成功。
5. 開発依存：Tailwind 4.3.3のNode APIとScannerへ移行。旧監視CLIとbracesの依存を除外。npm auditは0件。CSSビルドとルーレット/PDF画面の表示を確認。互換リセットを保持。Tailwind v4の対応ブラウザを前提とする。
6. 低優先度のファイル容量・画像画素・CSV行数制限は依頼どおり変更していない。

最終検証：npm test 44件、npm run check 26件（ローカルjsPDFを含む）、npm audit 0件。コードは未コミット・未プッシュ。Cloudflareログインと本番反映は未完了。

### HTTPS強制転送：本番設定完了（2026-10-23）

ユーザーのログイン後、対象ゾーンu-t-on.comの「常にHTTPSを使用」をオフからオンへ変更。証明書はアクティブ。通常のGETで以下を確認した。

- http://u-t-on.com/ → 301 → https://u-t-on.com/ → 200
- http://u-t-on.com/tools/image-joiner.html?security-check=1 → 301 → 同じパス・クエリのHTTPS → 200
- http://u-t-on.com/games/smartphone-rush.html → 301 → HTTPS → 200

転送ループなし。変更はこの転送設定のみ。HSTSやその他のヘッダー、CSV、ライブラリ更新等のコード修正は引き続き未コミット・未公開。証跡：.qa/cloudflare-https-enabled.png。

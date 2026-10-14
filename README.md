# u-creative-room

「Uの創作部屋」（https://u-t-on.com/）のソース一式です。

## ディレクトリ構成

```
u-creative-room/
├── u-t-on/            Webサイト本体（既存のデプロイ経路はこのまま）
└── apps/              各ツールのネイティブアプリ版（Capacitor）
    └── section-timer/ セクションタイマーのAndroid/iOSアプリ
```

Webサイト（`u-t-on/`）とアプリ（`apps/*`）は別プロジェクトとして分離しています。
Web版の各ツールをアプリ化する場合は `apps/` 配下に `apps/<ツール名>/` として追加してください。詳細は各アプリの README を参照してください。

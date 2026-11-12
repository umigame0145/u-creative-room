const SITE_DATA = {
    news: [
        { date: "2026.11.12", content: "名前と当たり数を設定できる「あみだくじ」を公開しました。経路アニメーションと結果一覧で抽選できます。" },
        { date: "2026.11.10", content: "読み物ページを公開しました。画像の差分率、モザイクの注意点、動画のフレームレートなど5本の解説と使い方ガイドを掲載しています。" },
        { date: "2026.11.10", content: "「このサイトについて」に運営者と制作方針を、プライバシーポリシーに免責事項を追加しました。" },
        { date: "2026.11.04", content: "画像比較を追加しました。2枚の画像の差分率と、違う部分を赤く重ねた画像を確認できます。" },
        { date: "2026.11.03", content: "動画コマ分解を追加しました。全フレーム・間隔指定での画像化、コマ送り、選んだコマのZIP保存に対応しています。" },
        { date: "2026.10.15", content: "7つのツールページに具体的な使用例を追加しました。歩きスマホラッシュに体当たり・おはじき反射などの遊び方を追加しました。" },
        { date: "2026.10.12", content: "ブラウザゲーム「歩きスマホラッシュ」を公開しました。" },
        { date: "2026.03.23", content: "画像の一部を透明にする「すけ透過？」と、モザイクツール「KOKOにモザイク」を公開しました。" },
        { date: "2026.03.22", content: "項目を自由に作れる「myルーレット」を公開しました。" },
        { date: "2026.03.18", content: "複数の項目を数えられる「なんでもカウンター」を公開しました。" },
        { date: "2026.03.09", content: "定型文を組み立てる「コピペったん」と、お問い合わせ・プライバシーポリシーのページを公開しました。" },
        { date: "2026.03.05", content: "複数の画像をPDFにまとめる「画像梱包（PDF）」を公開しました。" },
        { date: "2026.03.04", content: "「Uの創作部屋」を公開しました。" }
    ],
    icons: {
        "amidakuji": "amidakuji_icon.svg",
        "home": "home_icon.svg",
        "image-joiner": "image-joiner_icon.svg",
        "image-binder": "image-binder_icon.svg",
        "copy-pattan": "copy-pattan_icon.svg",
        "counter": "any-counter_icon.svg",
        "roulette": "my-roulette_icon.svg",
        "mosaic": "koko-ni-mosaic_icon.svg",
        "transparency": "suke-touka_icon.svg",
        "video-frames": "video-frames_icon.svg",
        "image-compare": "image-compare_icon.svg",
        "smartphone-rush": "smartphone-rush_icon.svg"
    },
    tools: [
        { id: "amidakuji", category: "count", name: "あみだくじ", description: "2〜20人の名前と当たり数を設定。線をたどるアニメーションと結果一覧で抽選できます。", icon: "amidakuji", url: "tools/amidakuji", isUpdate: true },
        {
            id: "image-compare",
            category: "image",
            name: "画像比較",
            description: "2枚の画像の差分率を数値で表示。違いのある部分に薄い赤を重ね、PNGで保存できます。画像は端末内で処理します。",
            icon: "image-compare",
            url: "tools/image-compare",
            isUpdate: true
        },
        {
            id: "video-frames",
            category: "image",
            name: "動画コマ分解",
            description: "動画を全フレームまたは指定間隔で画像に。1回200枚まで、コマ送り・ZIP保存・一覧画像に対応。端末内で処理します。",
            icon: "video-frames",
            url: "tools/video-frames",
            isUpdate: true
        },
        {
            id: "image-joiner",
            category: "image",
            name: "画像結合ツール",
            description: "複数の画像を縦や横に美しく結合。元のサイズの維持や、幅・高さを揃えた結合、背景透過に対応しています。",
            icon: "image-joiner",
            url: "tools/image-joiner",
            isUpdate: false
        },
        {
            id: "img-binder-pdf",
            category: "image",
            name: "画像梱包（PDF）",
            description: "複数の画像を1つのPDFファイルにまとめます。A4サイズへの自動収容や余白調整も可能です。",
            icon: "image-binder",
            url: "tools/img-binder-pdf",
            isUpdate: false
        },
        {
            id: "copy-pattan",
            category: "other",
            name: "コピペったん",
            description: "よく使うフレーズを組み合わせて、素早くクリップボードにコピーします。",
            icon: "copy-pattan",
            url: "tools/copy-pattan",
            isUpdate: false
        },
        {
            id: "any-counter",
            category: "count",
            name: "なんでもカウンター",
            description: "複数の項目をカウントし、割合や確率（1/N）をリアルタイムで算出する多用途カウンターです。",
            icon: "counter",
            url: "tools/any-counter",
            isUpdate: false
        },
        {
            id: "my-roulette",
            category: "count",
            name: "myルーレット",
            description: "自由に項目を作れるカスタムルーレット。完全確率モードと減算モードを搭載しています。",
            icon: "roulette",
            url: "tools/my-roulette",
            isUpdate: false
        },
        {
            id: "koko-ni-mosaic",
            category: "image",
            name: "KOKOにモザイク",
            description: "画像の好きな場所を隠せるモザイクツール。四角や丸、回転などの詳細な指定が可能です。",
            icon: "mosaic",
            url: "tools/koko-ni-mosaic",
            isUpdate: false
        },
        {
            id: "suke-touka",
            category: "image",
            name: "すけ透過？",
            description: "画像の好きな場所を透明にできる透過ツール。切り抜きや、重ねて使う素材作りに活用できます。",
            icon: "transparency",
            url: "tools/suke-touka",
            isUpdate: true
        },
    ],
    games: [
        { id: "smartphone-rush", name: "歩きスマホラッシュ", icon: "smartphone-rush", url: "games/smartphone-rush" }
    ],
    menuGroups: [
        {
            groupName: "画像編集ツール",
            items: [
                { name: "動画コマ分解", url: "tools/video-frames" },
                { name: "画像比較", url: "tools/image-compare" },
                { name: "画像結合ツール", url: "tools/image-joiner" },
                { name: "画像梱包（PDF）", url: "tools/img-binder-pdf" },
                { name: "KOKOにモザイク", url: "tools/koko-ni-mosaic" },
                { name: "すけ透過？", url: "tools/suke-touka" }
            ]
        },
        {
            groupName: "カウントツール",
            items: [
                { name: "なんでもカウンター", url: "tools/any-counter" },
                { name: "myルーレット", url: "tools/my-roulette" },
                { name: "あみだくじ", url: "tools/amidakuji" }
            ]
        },
        {
            groupName: "ゲーム",
            items: [{ name: "歩きスマホラッシュ", url: "games/smartphone-rush" }]
        },
        {
            groupName: "その他",
            items: [
                { name: "コピペったん", url: "tools/copy-pattan" }
            ]
        }
    ]
};

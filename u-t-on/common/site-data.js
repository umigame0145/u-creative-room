const SITE_DATA = {
    news: [
        { date: "2026.10.15", content: "7つのツールに具体的な使用例を追加し、歩きスマホラッシュのゲーム内容を完成させました。" },
        { date: "2026.10.13", content: "歩きスマホラッシュに体の衝突・スマホ破壊・おはじき反射を追加しました。" },
        { date: "2026.10.12", content: "歩きスマホラッシュを簡易3D表示に対応しました。" },
        { date: "2026.10.12", content: "ゲーム「歩きスマホラッシュ」の試作版を追加しました。" },
        { date: "2026.10.12", content: "セクションタイマーを削除しました。" },
        { date: "2026.03.23", content: "新ツール「すけ透過？」を追加しました！" },
        { date: "2026.03.23", content: "新ツール「KOKOにモザイク」を追加しました！" },
        { date: "2026.03.22", content: "新ツール「myルーレット」を追加しました！" },
        { date: "2026.03.18", content: "新ツール「なんでもカウンター」を追加しました！" },
        { date: "2026.03.09", content: "新ツール「コピペったん」を追加しました！" },
        { date: "2026.03.09", content: "お問い合わせを追加しました！" },
        { date: "2026.03.09", content: "プライバシーポリシーを追加しました！" },
        { date: "2026.03.06", content: "シェア機能ヘッダに追加しました！" },
        { date: "2026.03.05", content: "新ツール「画像梱包（PDF）」を追加しました！" },
        { date: "2026.03.04", content: "サイト公開しました！" }
    ],
    icons: {
        "home": "home_icon.svg",
        "image-joiner": "image-joiner_icon.svg",
        "image-binder": "image-binder_icon.svg",
        "copy-pattan": "copy-pattan_icon.svg",
        "counter": "any-counter_icon.svg",
        "roulette": "my-roulette_icon.svg",
        "mosaic": "koko-ni-mosaic_icon.svg",
        "transparency": "suke-touka_icon.svg",
        "smartphone-rush": "smartphone-rush_icon.svg"
    },
    tools: [
        {
            id: "image-joiner",
            category: "image",
            name: "画像結合ツール",
            description: "複数の画像を縦や横に美しく結合。元のサイズの維持や、幅・高さを揃えた結合、背景透過に対応しています。",
            icon: "image-joiner",
            url: "tools/image-joiner.html",
            isUpdate: false
        },
        {
            id: "img-binder-pdf",
            category: "image",
            name: "画像梱包（PDF）",
            description: "複数の画像を1つのPDFファイルにまとめます。A4サイズへの自動収容や余白調整も可能です。",
            icon: "image-binder",
            url: "tools/img-binder-pdf.html",
            isUpdate: false
        },
        {
            id: "copy-pattan",
            category: "other",
            name: "コピペったん",
            description: "よく使うフレーズを組み合わせて、素早くクリップボードにコピーします。",
            icon: "copy-pattan",
            url: "tools/copy-pattan.html",
            isUpdate: false
        },
        {
            id: "any-counter",
            category: "count",
            name: "なんでもカウンター",
            description: "複数の項目をカウントし、割合や確率（1/N）をリアルタイムで算出する多用途カウンターです。",
            icon: "counter",
            url: "tools/any-counter.html",
            isUpdate: false
        },
        {
            id: "my-roulette",
            category: "count",
            name: "myルーレット",
            description: "自由に項目を作れるカスタムルーレット。完全確率モードと減算モードを搭載しています。",
            icon: "roulette",
            url: "tools/my-roulette.html",
            isUpdate: false
        },
        {
            id: "koko-ni-mosaic",
            category: "image",
            name: "KOKOにモザイク",
            description: "画像の好きな場所を隠せるモザイクツール。四角や丸、回転などの詳細な指定が可能です。",
            icon: "mosaic",
            url: "tools/koko-ni-mosaic.html",
            isUpdate: false
        },
        {
            id: "suke-touka",
            category: "image",
            name: "すけ透過？",
            description: "画像の好きな場所を透明にできる透過ツール。切り抜きや、重ねて使う素材作りに活用できます。",
            icon: "transparency",
            url: "tools/suke-touka.html",
            isUpdate: true
        },
    ],
    games: [
        { id: "smartphone-rush", name: "歩きスマホラッシュ", icon: "smartphone-rush", url: "games/smartphone-rush.html" }
    ],
    menuGroups: [
        {
            groupName: "画像編集ツール",
            items: [
                { name: "画像結合ツール", url: "tools/image-joiner.html" },
                { name: "画像梱包（PDF）", url: "tools/img-binder-pdf.html" },
                { name: "KOKOにモザイク", url: "tools/koko-ni-mosaic.html" },
                { name: "すけ透過？", url: "tools/suke-touka.html" }
            ]
        },
        {
            groupName: "カウントツール",
            items: [
                { name: "なんでもカウンター", url: "tools/any-counter.html" },
                { name: "myルーレット", url: "tools/my-roulette.html" }
            ]
        },
        {
            groupName: "ゲーム",
            items: [{ name: "歩きスマホラッシュ", url: "games/smartphone-rush.html" }]
        },
        {
            groupName: "その他",
            items: [
                { name: "コピペったん", url: "tools/copy-pattan.html" }
            ]
        }
    ]
};

const SITE_DATA = {
    news: [
        { date: "2026.03.09", content: "新機能コピペったんを追加しました！" },
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
        "copy-pattan": "copy-pattan_icon.svg"
    },
    tools: [
        {
            id: "image-joiner",
            category: "image",
            name: "画像結合ツール",
            description: "複数の画像を縦や横に美しく結合。背景透過やHEIC形式にも対応しています。",
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
            isUpdate: true
        },
    ],
    menuGroups: [
        {
            groupName: "画像編集ツール",
            items: [
                { name: "画像結合ツール", url: "tools/image-joiner.html" },
                { name: "画像梱包（PDF）", url: "tools/img-binder-pdf.html" }
            ]
        },
        {
            groupName: "その他",
            items: [
                { name: "コピペったん", url: "tools/copy-pattan.html" }
            ]
        }
    ]
};
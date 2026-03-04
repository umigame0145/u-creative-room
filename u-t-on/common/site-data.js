const SITE_DATA = {
    news: [
        { date: "2026.03.05", content: "新ツール「画像梱包（PDF）」を追加しました！" },
        { date: "2026.03.04", content: "サイト公開しました！" }
    ],
    tools: [
        {
            id: "image-joiner",
            category: "image",
            name: "画像結合ツール",
            description: "複数の画像を縦や横に美しく結合。背景透過やHEIC形式にも対応しています。",
            icon: "🖼️",
            url: "tools/image-joiner.html",
            isUpdate: true
        },
        {
            id: "img-binder-pdf",
            category: "image",
            name: "画像梱包（PDF）",
            description: "複数の画像を1つのPDFファイルにまとめます。A4サイズへの自動収容や余白調整も可能です。",
            icon: "📂",
            url: "tools/img-binder-pdf.html",
            isUpdate: true
        }
    ],
    menuGroups: [
        {
            groupName: "画像編集ツール",
            items: [
                { name: "画像結合ツール", url: "tools/image-joiner.html" },
                { name: "画像梱包（PDF）", url: "tools/img-binder-pdf.html" }
            ]
        }
    ]
};
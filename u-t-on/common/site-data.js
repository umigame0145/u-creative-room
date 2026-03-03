/**
 * Uの創作部屋：コンテンツデータ
 */
const SITE_DATA = {
    news: [
        { date: "2026.03.04", content: "サイト公開しました！" },
    ],
    tools: [
        {
            id: "image-joiner",
            category: "image", // カテゴリ分け用
            name: "画像結合ツール",
            description: "複数の画像を縦や横に美しく結合。背景透過やHEIC形式にも対応しています。",
            icon: "🖼️",
            url: "tools/image-joiner.html",
            isUpdate: true
        }
    ],
    menuGroups: [
        {
            groupName: "画像編集ツール",
            items: [
                { name: "画像結合ツール", url: "tools/image-joiner.html" }
            ]
        }
        // 今後、ここに「テキストツール」などを追加していく予定
    ]
};
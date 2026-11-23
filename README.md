# mmm tools

ポケモンオフ会・大会の参加者パーティCSVからKPを集計する、静的ウェブアプリです。

公開URL: https://amuma.github.io/mmmtools/

## 機能

- 参加者名・ポケモン1〜6の7列のCSVを選択またはドロップして集計
- UTF-8（BOMあり・なし）とShift_JISの自動判別／手動指定
- ポケモン別KP・採用率、参加者別KP合計・パーティ内訳を表示
- 検索、並び替え、25件単位のページ表示
- 全件を2シートのExcel（.xlsx）でダウンロード
- CSVテンプレート、行番号付きの入力エラー表示
- レスポンシブ表示、キーボード操作、静的HTMLの説明文・メタ情報・構造化データ・サイトマップ

## KPの定義

KPは、そのポケモンを採用した参加者数です。自身の採用を含みます。参加者別KP合計はパーティ6匹のKPの合計、採用率はKP÷参加者数です。同じKPは同順位（1, 1, 3方式）です。

ポケモン名はUnicode NFKCによる全半角の統一と前後の空白除去を行います。フォルムや異なる表記は自動統合しません。参加者名の重複、1パーティ内の同一ポケモンの重複、空欄、不正な列数はエラーです。ポケモン名辞書による入力内容の正誤判定はしません。

## CSV形式

```csv
参加者名,ポケモン1,ポケモン2,ポケモン3,ポケモン4,ポケモン5,ポケモン6
たろう,カイリュー,ハバタクカミ,サーフゴー,パオジアン,ディンルー,オーガポン
```

ヘッダーは省略可能。付ける場合は上記の見出しを使用してください。最大5MB／5,000人。カンマ、引用符、セル内改行に対応します。テンプレートはExcelで開きやすいBOM付きUTF-8です。

## GitHub Pagesへの公開

ビルド、npm、APIキーは不要です。

1. このフォルダの内容を `amuma/mmmtools` の `main` ブランチ直下へ配置します。
2. GitHubのリポジトリで **Settings → Pages** を開きます。
3. **Build and deployment → Source** を **Deploy from a branch** にします。
4. **Branch** を **main**、フォルダを **/(root)** にして **Save** を押します。
5. GitHubのPagesビルドが完了すると `https://amuma.github.io/mmmtools/` で公開されます。

非公開リポジトリでのPages利用には、GitHubプランによる制限があります。Settings → Pagesに表示される条件を確認してください。リポジトリを公開に変更する場合は所有者が内容を確認してから行ってください。

公式手順: [公開元の設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

公開先URLを変更するときは、`index.html` のcanonical・OGP・構造化データ、`robots.txt`、`sitemap.xml` のURLを更新してください。SEO用の説明文や見出しはJavaScript実行前からHTML内にあります。検索結果への登録や順位を保証するものではありません。

## ローカル確認

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:4173/` を開きます。ES Modulesを使うため、`index.html` の直接ダブルクリックではなくHTTPサーバーから開いてください。

## テスト

Node.js 20以上で、追加インストールなしに実行できます。

```powershell
node --test tests/core.test.mjs
```

KP計算、CSVの引用符・改行、文字コード、入力エラー、5,000人の集計、Excel生成と再読込、式として解釈されない文字列出力を検証します。

## 構成・プライバシー

- `index.html`: 検索可能な説明文と画面構造
- `assets/style.css`: 黒基調のデザイン
- `assets/core.js`: CSV解析、検証、KP集計
- `assets/workbook.js`: Excel生成
- `assets/app.js`: 画面とファイル操作
- `assets/vendor/`: 同梱したExcelJS 4.4.0（MIT License）

入力ファイルはブラウザのメモリ上だけで処理します。集計データの外部送信、アクセス解析、Cookie、localStorageは使用しません。ページ配信時の通常のアクセスログはホスティング事業者の管理対象です。依存ライブラリも同梱し、実行時のCDNへの接続を不要にしています。

ExcelJS: https://github.com/exceljs/exceljs （ライセンスは `assets/vendor/EXCELJS-LICENSE.txt` に同梱）

本ツールは非公式で、任天堂・クリーチャーズ・ゲームフリークとは関係ありません。

# OTOIRO

MIDIの音符を譜面表示し、音符・音階・休符の色を編集してPNGへ出力するブラウザーアプリです。

## GitHub Pages

このリポジトリはGitHub ActionsからGitHub Pagesへ自動デプロイする設定です。`main`ブランチへpushするたびにテスト、lint、本番ビルドを実行し、成功したビルドを公開します。Actionsタブから手動実行することもできます。

初回のみGitHubリポジトリの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定してください。公開URLは通常 `https://<アカウント名>.github.io/gakufu/` です。リポジトリ名を変更した場合は、公開パスの設定も更新してください。

## ローカル開発

```sh
npm ci
npm run dev
```

## 検証

```sh
npm test -- --run
npm run lint
npm run build
```

画像ファイルは参照用表示のみで、画像からの自動採譜には対応していません。
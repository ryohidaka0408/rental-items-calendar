# 社内機器レンタル管理システム

Next.js (App Router) + Firebase (Authentication / Firestore) + FullCalendar で構築した、
社内機器の予約状況を管理するカレンダーアプリです。

## 主な機能

- ログイン(メール/パスワード・Googleアカウント)しないとカレンダー・機器一覧を閲覧できない
- **許可リスト方式のアクセス制限**: `allowedUsers` コレクションに登録されたメールアドレスの
  ユーザーのみが利用可能(セルフサインアップは廃止。アカウントはFirebaseコンソールから
  管理者が付与する運用)
- FullCalendarによる予約作成・編集・削除
- 機器の保有台数(`quantity`)を考慮した二重予約防止(重なっていても保有台数未満なら予約可能)
- 機器一覧ページでの「貸出可能な残り台数」表示
- 返却期限が24時間以内(超過分も含む)の予約を一覧表示するリマインドセクション

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Firebaseプロジェクトの準備

1. [Firebaseコンソール](https://console.firebase.google.com/) で新規プロジェクトを作成する
   (料金プランは無料の **Sparkプラン** のままで問題ありません)
2. 「ビルド」→「Firestore Database」からデータベースを作成する
   (ロケールは任意、モードは「本番環境モード」で開始してOK。ルールは後述の
   `firestore.rules` の内容に置き換えます)
3. 「ビルド」→「Authentication」を開き、「Sign-in method」タブで以下を有効化する
   - **メール/パスワード**: 有効にする
   - **Google**: 有効にし、プロジェクトのサポートメールを設定する
4. 「プロジェクトの設定」→「全般」→「マイアプリ」でWebアプリを追加し、
   表示される `firebaseConfig` の値を控える

### 3. 環境変数の設定

`.env.local.example` を `.env.local` にコピーし、Firebaseコンソールで取得した値を設定する。

```bash
cp .env.local.example .env.local
```

| 変数名 | 内容 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web APIキー |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 認証ドメイン(`xxx.firebaseapp.com`) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | プロジェクトID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | ストレージバケット |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 送信者ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | アプリID |

### 4. Firestoreセキュリティルールの適用

`firestore.rules` は認証済みユーザーのみ読み書き可能な内容になっています。
Firebase CLIでデプロイするか、コンソールの「Firestore Database」→「ルール」から
同内容を貼り付けて公開してください。

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,firestore:indexes
```

`firestore.indexes.json` には返却期限の検索(`getUpcomingDeadlines`)や
在庫集計(`getActiveReservationCounts`)に必要な複合インデックス
(`reservations` コレクションの `status` + `end`)を定義しています。
デプロイせずに実行した場合、初回クエリ実行時にコンソールへのインデックス作成リンクが
エラーメッセージに表示されるので、そちらから作成することも可能です。

### 5. 利用者の許可(allowedUsers)

このアプリはFirebase Authenticationでログインできても、`allowedUsers` コレクションに
登録されていないメールアドレスのユーザーは「アクセス権がありません」画面がでて
中身を閲覧できません。利用を許可したいユーザーごとに、Firebaseコンソールの
「Firestore Database」→「データ」タブから以下の手順でドキュメントを追加してください。

1. コレクションID: `allowedUsers` を新規作成(初回のみ)
2. ドキュメントID: 許可したい**メールアドレスをそのまま**入力(例: `taro@example.com`)
3. フィールドは何でも構いません(例: `note`(文字列)に担当者名などを入れておくと管理しやすい)

Googleアカウントでログインする場合はこのドキュメントを追加するだけで即座に利用できます。
メール/パスワードでログインする場合は、加えて「Authentication」→「Users」→
「ユーザーを追加」で当人のアカウント(メール・初期パスワード)も作成しておく必要があります。

利用を停止したい場合は、`allowedUsers` の該当ドキュメントを削除するだけで、
次回アクセス時から利用できなくなります(既存のログインセッションは
「アクセス権がありません」画面に切り替わります)。

### 6. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開くとログイン画面が表示されます。
上記の手順で `allowedUsers` に登録したメールアドレスのアカウントでログインしてください。

## Firestoreデータ構造

- `equipment` コレクション: `name`, `category?`, `quantity`(保有台数), `note?`, `createdAt`, `updatedAt`
- `reservations` コレクション: `equipmentId`, `equipmentName`, `start`, `end`(いずれもISO 8601文字列),
  `reservedByUid`, `reservedByName`, `reservedByEmail`, `status`(`confirmed` | `cancelled`),
  `note?`, `createdAt`, `updatedAt`

## ディレクトリ構成

- `src/lib/firebase.ts` — Firebase初期化(環境変数で設定)
- `src/lib/equipment.ts` — `equipment` コレクションのCRUD
- `src/lib/reservations.ts` — `reservations` コレクションのCRUD・在庫を考慮した重複チェック・
  リマインド取得(`getUpcomingDeadlines`)
- `src/lib/auth-context.tsx` — Firebase Authenticationのラッパー(Context/Hook)
- `src/components/CalendarView.tsx` — FullCalendar表示
- `src/components/ReservationModal.tsx` — 予約作成・編集モーダル
- `src/components/NavHeader.tsx` / `AppShell.tsx` — ヘッダー・ログインガード
- `src/app/page.tsx` — カレンダーページ(返却期限リマインド付き)
- `src/app/equipment/page.tsx` — 機器一覧・管理ページ
- `src/app/login/page.tsx` — ログインページ

## ビルド・検証

```bash
npm run build
npx eslint src --ext .ts,.tsx
```

## デプロイ

[Vercel Platform](https://vercel.com/new) へのデプロイが簡単です。デプロイ時は上記の
環境変数をVercelのプロジェクト設定にも同じ値で登録してください。

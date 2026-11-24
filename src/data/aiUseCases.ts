// ホテル経営の各業務で、AIによって効率化・高度化できる領域の一覧。
// 効果の数値は一般的な導入事例から見た「目安」であり、ホテルの規模・運営形態で変わります。

export type Level = 1 | 2 | 3; // 1=低 / 2=中 / 3=高

export type Department = {
  id: string;
  name: string;
  summary: string;
};

export type UseCase = {
  id: string;
  departmentId: string;
  title: string;
  pain: string; // 現状の課題
  solution: string; // AIで何をするか
  effect: string; // 期待効果（目安）
  impact: Level; // 効果の大きさ
  difficulty: Level; // 導入難易度
  dataNeeded: string[]; // 必要なデータ・連携先
  tools: string; // 実現手段（製品カテゴリ）
  caution?: string; // 注意点
  demoHref?: string; // このサイト内で動くデモ
};

export const DEPARTMENTS: Department[] = [
  { id: "front", name: "フロント・予約", summary: "チェックイン/アウト、予約受付、問い合わせ対応" },
  { id: "revenue", name: "レベニュー・販売", summary: "価格設定、在庫配分、OTA・チャネル管理" },
  { id: "marketing", name: "マーケティング・CRM", summary: "集客、SNS、口コミ、リピーター育成" },
  { id: "housekeeping", name: "客室・ハウスキーピング", summary: "清掃割当、点検、リネン・備品管理" },
  { id: "fb", name: "料飲（F&B）", summary: "レストラン・朝食・宴会の運営と仕入れ" },
  { id: "facility", name: "施設・設備管理", summary: "設備保全、エネルギー、安全管理" },
  { id: "backoffice", name: "経理・人事・総務", summary: "シフト、採用、教育、経理、法令対応" },
  { id: "management", name: "経営管理", summary: "数値管理、レポーティング、意思決定支援" },
];

export const USE_CASES: UseCase[] = [
  // ---------- フロント・予約 ----------
  {
    id: "chatbot",
    departmentId: "front",
    title: "多言語AIチャットボットによる問い合わせ一次対応",
    pain: "アクセス・駐車場・アメニティなど同じ質問への電話/メール対応にフロントの時間が取られる。夜間や外国語対応も負担。",
    solution: "館内情報・FAQを学習させた生成AIチャットボットをWebサイト・LINE・館内QRに設置し、24時間多言語で回答。解決できない質問のみスタッフに引き継ぐ。",
    effect: "定型問い合わせの60〜80%を自動化、電話件数の削減",
    impact: 3,
    difficulty: 1,
    dataNeeded: ["館内案内・FAQ", "宿泊約款・キャンセルポリシー", "周辺情報"],
    tools: "生成AIチャットボット（LINE/Web対応）、FAQ自動生成",
    caution: "料金・キャンセル規定など誤回答が問題になる項目は、正式な情報源から引用させ、回答範囲を限定する。",
  },
  {
    id: "email-reply",
    departmentId: "front",
    title: "予約メール・OTAメッセージの返信文作成",
    pain: "OTA経由のメッセージや要望メール（記念日、アレルギー、到着時間など）に一件ずつ返信文を書いている。",
    solution: "受信メッセージの意図を分類し、予約情報と館内ルールを踏まえた返信案を生成AIが下書き。スタッフは確認・送信のみ。要望は自動でPMSの備考に転記。",
    effect: "返信作成時間を1件あたり約5分→1分に短縮",
    impact: 2,
    difficulty: 1,
    dataNeeded: ["受信メール/OTAメッセージ", "予約情報（PMS）", "返信テンプレート"],
    tools: "生成AI（メール下書き）、PMS・メール連携",
  },
  {
    id: "phone-ai",
    departmentId: "front",
    title: "AI電話応対（ボイスボット）",
    pain: "ピーク時に電話がつながらず予約の取りこぼしが発生。夜間は少人数で電話と対面対応が重なる。",
    solution: "音声認識＋生成AIで電話の一次応答を行い、空室照会・予約確認・よくある質問に回答。複雑な案件は要件を要約してスタッフへ転送。",
    effect: "受電の30〜50%を自動完結、取りこぼし予約の削減",
    impact: 2,
    difficulty: 2,
    dataNeeded: ["空室・料金（PMS/サイトコントローラー）", "FAQ"],
    tools: "AIボイスボット、IVR連携",
  },
  {
    id: "self-checkin",
    departmentId: "front",
    title: "セルフチェックイン・本人確認の自動化",
    pain: "チェックインの集中時間に行列ができ、外国人客のパスポート確認・宿泊者名簿の記入に時間がかかる。",
    solution: "キオスク/スマホ事前チェックインで、パスポートや身分証をOCRで読み取り宿泊者名簿を自動作成。顔照合で本人確認を補助。",
    effect: "チェックイン所要時間を約50〜70%短縮",
    impact: 3,
    difficulty: 2,
    dataNeeded: ["予約情報（PMS）", "本人確認書類画像"],
    tools: "セルフチェックイン端末、OCR、顔認証",
    caution: "旅館業法上の宿泊者名簿・旅券写しの保存要件と、個人情報保護（取得目的の明示）に対応すること。",
  },
  {
    id: "translation",
    departmentId: "front",
    title: "リアルタイム翻訳による外国人客対応",
    pain: "英語以外（中国語・韓国語・タイ語など）の対応ができるスタッフが限られる。",
    solution: "フロントや客室の翻訳端末・タブレットでAI音声翻訳を活用。館内掲示や案内文も多言語に自動翻訳。",
    effect: "外国語対応の属人化を解消、案内物の翻訳コスト削減",
    impact: 2,
    difficulty: 1,
    dataNeeded: ["館内案内文"],
    tools: "AI翻訳（音声・テキスト）",
  },

  // ---------- レベニュー・販売 ----------
  {
    id: "dynamic-pricing",
    departmentId: "revenue",
    title: "AIダイナミックプライシング（客室単価の最適化）",
    pain: "担当者の経験と勘で料金を決めており、競合・イベント・需要変化への追随が遅れる。毎日の料金見直しに時間がかかる。",
    solution: "競合価格・イベント・天候・景気・予約ペースから需要を予測し、RevPARが最大になる価格を部屋タイプ／プラン別・日別に算出して根拠とともに提示。",
    effect: "RevPAR 5〜15%改善、料金調整作業の大幅削減",
    impact: 3,
    difficulty: 2,
    dataNeeded: ["過去の予約実績（PMS）", "競合価格", "イベント・天候情報"],
    tools: "レベニューマネジメントシステム（RMS）",
    demoHref: "/",
  },
  {
    id: "demand-forecast",
    departmentId: "revenue",
    title: "需要・稼働率・ピックアップ予測",
    pain: "先の日付の稼働見込みがわからず、販促やオーバーブッキングの判断が遅れる。",
    solution: "過去の予約カーブ（ピックアップ）と外部要因から日別の最終稼働率・キャンセル率を予測。予測と実績の乖離が大きい日をアラート。",
    effect: "予測誤差の縮小、人員・仕入れ計画の精度向上",
    impact: 3,
    difficulty: 2,
    dataNeeded: ["予約・キャンセル履歴", "オンハンド（在庫）推移"],
    tools: "需要予測AI、RMS",
  },
  {
    id: "channel",
    departmentId: "revenue",
    title: "OTA・チャネル配分と手数料の最適化",
    pain: "どのOTAにいくら在庫を出すか、直販比率をどう上げるかが感覚的。手数料負担が大きい。",
    solution: "チャネル別の予約単価・キャンセル率・手数料を分析し、純収益が高いチャネルへの在庫配分を提案。直販への誘導施策も評価。",
    effect: "販売手数料の削減、直販比率の向上",
    impact: 2,
    difficulty: 2,
    dataNeeded: ["チャネル別予約データ", "手数料率"],
    tools: "サイトコントローラー＋分析AI",
  },
  {
    id: "group-quote",
    departmentId: "revenue",
    title: "団体・法人見積もりの自動作成",
    pain: "団体・MICE・法人の見積もり依頼に、在庫と料金を確認しながら手作業で見積書を作っている。",
    solution: "依頼内容（日程・人数・宴会有無）を読み取り、その日の需要予測と置き換わる個人予約の収益（ディスプレイスメント）を考慮した見積もり案を自動作成。",
    effect: "見積回答スピードの向上、受注判断の精度向上",
    impact: 2,
    difficulty: 3,
    dataNeeded: ["需要予測", "宴会場・客室在庫", "過去の団体実績"],
    tools: "生成AI＋RMS連携",
  },

  // ---------- マーケティング・CRM ----------
  {
    id: "review-reply",
    departmentId: "marketing",
    title: "口コミの分析と返信文作成",
    pain: "複数OTA・Googleの口コミを読み、一件ずつ返信するのに時間がかかる。改善点の集計もできていない。",
    solution: "口コミを自動収集し、清掃・接客・朝食などテーマ別に感情分析。ポジティブ/ネガティブに応じた返信案を生成し、繰り返し出る不満を部署別に通知。",
    effect: "返信工数を約70%削減、評価スコア改善のPDCA",
    impact: 3,
    difficulty: 1,
    dataNeeded: ["OTA・Googleの口コミ"],
    tools: "口コミ管理ツール、生成AI",
    caution: "定型文の使い回しに見えないよう、具体的な指摘への言及を必ず入れ、最終確認は人が行う。",
  },
  {
    id: "content",
    departmentId: "marketing",
    title: "SNS投稿・プラン紹介文・広告文の作成",
    pain: "プランページやSNS、メルマガの文章・画像作りが担当者のスキルと時間に依存している。",
    solution: "季節・イベント・ターゲットに合わせて、プラン紹介文、SNS投稿、広告コピー、多言語版を生成AIで量産。写真の補正やバナー案も生成。",
    effect: "コンテンツ制作時間を50%以上削減、投稿頻度の向上",
    impact: 2,
    difficulty: 1,
    dataNeeded: ["プラン情報", "写真素材", "ブランドガイド"],
    tools: "生成AI（文章・画像）",
    caution: "実際と異なる写真・表現は景品表示法上の問題になるため、生成画像の扱いに注意。",
  },
  {
    id: "personalize",
    departmentId: "marketing",
    title: "顧客セグメント分析とパーソナライズ施策",
    pain: "顧客データはあるが活用できておらず、全員に同じメルマガを送っている。",
    solution: "宿泊履歴・利用目的・単価から顧客をクラスタリングし、再訪の可能性が高い顧客に最適なタイミング・内容でオファーを自動配信。",
    effect: "リピート率・メール経由予約の向上",
    impact: 3,
    difficulty: 2,
    dataNeeded: ["顧客・宿泊履歴（PMS/CRM）", "メール開封・予約データ"],
    tools: "CRM／MAツール＋AI分析",
  },
  {
    id: "upsell",
    departmentId: "marketing",
    title: "アップセル・クロスセルの自動提案",
    pain: "客室アップグレードや食事・オプションの提案がスタッフ任せで機会損失が出ている。",
    solution: "予約内容・顧客属性・当日の空室状況から、受け入れられやすいアップグレードや付帯サービスを事前メールやチェックイン時に自動提案。",
    effect: "客単価（付帯収入）の向上",
    impact: 2,
    difficulty: 2,
    dataNeeded: ["予約情報", "空室状況", "過去の購入履歴"],
    tools: "アップセルツール、レコメンドAI",
  },

  // ---------- 客室・ハウスキーピング ----------
  {
    id: "hk-assign",
    departmentId: "housekeeping",
    title: "清掃割当・ルート作成の自動化",
    pain: "毎朝、チェックアウト予定や連泊状況を見ながら清掃担当の割当表を手作業で作っている。",
    solution: "チェックアウト予定・到着予定時刻・部屋タイプ・スタッフの稼働時間から、優先順位と移動効率を考慮した清掃割当とルートを自動作成。",
    effect: "割当作業30分→数分、清掃完了時間の短縮",
    impact: 3,
    difficulty: 2,
    dataNeeded: ["客室ステータス（PMS）", "スタッフ勤務表"],
    tools: "ハウスキーピング管理システム",
  },
  {
    id: "room-inspect",
    departmentId: "housekeeping",
    title: "画像認識による客室点検の補助",
    pain: "清掃後の点検がインスペクターの目視頼りで、見落としや品質のばらつきがある。",
    solution: "清掃後の写真をAIが解析し、ベッドメイク・アメニティ配置・汚れの見落としを検知してチェックリスト化。",
    effect: "点検時間の短縮、品質の平準化",
    impact: 2,
    difficulty: 3,
    dataNeeded: ["客室写真（基準画像）"],
    tools: "画像認識AI",
  },
  {
    id: "linen",
    departmentId: "housekeeping",
    title: "リネン・アメニティの需要予測と発注",
    pain: "リネンやアメニティの在庫を勘で発注し、欠品や過剰在庫が起きる。",
    solution: "稼働予測と客室タイプ別の消費実績から、必要数量を予測して発注量を提案。",
    effect: "在庫・廃棄コストの削減、欠品防止",
    impact: 1,
    difficulty: 1,
    dataNeeded: ["稼働予測", "消費・発注履歴"],
    tools: "需要予測＋在庫管理",
  },

  // ---------- 料飲（F&B） ----------
  {
    id: "fb-forecast",
    departmentId: "fb",
    title: "朝食・レストラン来客数予測",
    pain: "朝食の喫食数が読めず、作りすぎによる食品ロスや人員過不足が起きる。",
    solution: "宿泊人数・プラン（朝食付き率）・団体・曜日・天候から時間帯別の来客数を予測し、仕込み量と配置人数を提案。",
    effect: "食品ロス10〜30%削減、人件費の適正化",
    impact: 3,
    difficulty: 2,
    dataNeeded: ["宿泊予約（朝食付き人数）", "過去の喫食実績", "POSデータ"],
    tools: "来客予測AI、POS連携",
  },
  {
    id: "purchasing",
    departmentId: "fb",
    title: "食材発注・在庫管理の自動化",
    pain: "食材の発注をFAX・電話で行い、在庫確認も手作業。",
    solution: "来客予測とレシピ（原価表）から必要食材量を計算し、発注書を自動作成。請求書はOCRで読み取り原価管理へ自動連携。",
    effect: "発注・検収作業の削減、原価率の改善",
    impact: 2,
    difficulty: 2,
    dataNeeded: ["レシピ・原価表", "在庫", "来客予測"],
    tools: "受発注システム、OCR",
  },
  {
    id: "menu",
    departmentId: "fb",
    title: "メニュー開発・アレルギー表示の支援",
    pain: "メニュー表の多言語化やアレルゲン表示の確認に手間がかかる。",
    solution: "レシピからアレルゲン情報を一覧化し、多言語メニュー表を自動生成。売上・原価データから人気と利益率を分析してメニュー改善を提案。",
    effect: "メニュー作成時間の短縮、表示ミスの防止",
    impact: 1,
    difficulty: 1,
    dataNeeded: ["レシピ", "POS売上"],
    tools: "生成AI、メニュー分析",
    caution: "アレルゲン表示は最終的に人がレシピと照合して確認すること。",
  },

  // ---------- 施設・設備管理 ----------
  {
    id: "energy",
    departmentId: "facility",
    title: "空調・照明のAIエネルギー最適化",
    pain: "空室や共用部でも空調・照明が稼働し、光熱費が高止まりしている。",
    solution: "客室の在室状況（PMS・センサー）と天候予測から、空調・給湯・照明の運転を自動制御。",
    effect: "光熱費 10〜20%削減",
    impact: 3,
    difficulty: 3,
    dataNeeded: ["客室ステータス", "BEMS/センサーデータ", "天気予報"],
    tools: "BEMS、IoTセンサー＋AI制御",
  },
  {
    id: "maintenance",
    departmentId: "facility",
    title: "設備の予知保全と修繕依頼の自動整理",
    pain: "ボイラー・空調・エレベーターの故障が突発的に起き、客室を売り止めにすることがある。修繕依頼もメモや口頭で漏れが出る。",
    solution: "設備センサーの異常兆候を検知して故障前に点検を促す。スタッフの音声・写真の修繕報告をAIが分類・優先度付けしてチケット化。",
    effect: "突発故障・販売停止客室の削減、修繕対応の漏れ防止",
    impact: 2,
    difficulty: 3,
    dataNeeded: ["設備センサーデータ", "修繕履歴"],
    tools: "予知保全AI、保守管理システム",
  },
  {
    id: "security",
    departmentId: "facility",
    title: "防犯カメラ映像の異常検知",
    pain: "防犯カメラの映像を常時監視する人員がいない。",
    solution: "映像解析AIで不審行動・転倒・立ち入り禁止区域への侵入などを検知し、スタッフに通知。",
    effect: "監視負担の軽減、事故・トラブルの早期対応",
    impact: 1,
    difficulty: 2,
    dataNeeded: ["カメラ映像"],
    tools: "映像解析AI",
    caution: "撮影・解析の目的を掲示し、プライバシーに配慮した運用ルールを定めること。",
  },

  // ---------- 経理・人事・総務 ----------
  {
    id: "shift",
    departmentId: "backoffice",
    title: "需要予測に連動したシフト自動作成",
    pain: "シフト作成に毎月何時間もかかり、繁閑に合わない配置で人手不足や過剰人員が出る。",
    solution: "稼働・来客予測から部署別・時間帯別の必要人数を算出し、スタッフの希望・スキル・労働時間規制を満たすシフト案を自動作成。",
    effect: "シフト作成時間を約80%削減、人件費率の改善",
    impact: 3,
    difficulty: 2,
    dataNeeded: ["需要予測", "スタッフの希望・スキル", "勤怠データ"],
    tools: "シフト最適化AI、勤怠管理",
  },
  {
    id: "training",
    departmentId: "backoffice",
    title: "マニュアル検索とスタッフ教育",
    pain: "業務マニュアルが紙やファイルに散在し、新人・外国人スタッフの教育に先輩の時間が取られる。",
    solution: "社内マニュアルを生成AIに読み込ませ、スタッフがスマホで質問すると手順を回答する社内アシスタントを構築。接客ロールプレイや多言語の研修資料も生成。",
    effect: "教育時間の短縮、早期戦力化、離職防止",
    impact: 2,
    difficulty: 1,
    dataNeeded: ["業務マニュアル", "SOP・社内規程"],
    tools: "社内向け生成AIアシスタント（RAG）",
  },
  {
    id: "accounting",
    departmentId: "backoffice",
    title: "請求書処理・経理仕訳の自動化",
    pain: "仕入先からの請求書を手入力し、売上（PMS）と入金（OTA・カード）の照合にも時間がかかる。",
    solution: "請求書をAI-OCRで読み取り仕訳を自動作成。PMSの売上とOTA・決済代行の入金データを自動照合し、差異だけを担当者に提示。",
    effect: "月次締め作業の短縮、入力ミス削減",
    impact: 2,
    difficulty: 2,
    dataNeeded: ["請求書", "PMS売上", "入金明細"],
    tools: "AI-OCR、会計システム",
  },
  {
    id: "recruit",
    departmentId: "backoffice",
    title: "求人原稿作成・応募者対応の効率化",
    pain: "慢性的な人手不足で採用活動が多いが、求人票作成や応募者への連絡に手が回らない。",
    solution: "職種ごとの求人原稿を生成AIで作成・多言語化。応募者への日程調整・よくある質問をチャットボットで自動化。",
    effect: "採用担当の工数削減、応募者の離脱防止",
    impact: 1,
    difficulty: 1,
    dataNeeded: ["職務内容", "勤務条件"],
    tools: "生成AI、採用管理ツール",
    caution: "応募者の選考判断そのものをAIに任せる場合は、公平性・説明責任に注意。",
  },

  // ---------- 経営管理 ----------
  {
    id: "reporting",
    departmentId: "management",
    title: "日報・月次レポートの自動作成",
    pain: "PMS・POS・会計からデータを集めてExcelで日報や会議資料を作るのに毎日時間がかかる。",
    solution: "各システムのデータを自動集計し、稼働率・ADR・RevPAR・GOPなどのKPIダッシュボードと、前年比・予算比の要因コメントを生成AIが文章化。",
    effect: "レポート作成時間を数時間→数分に短縮",
    impact: 3,
    difficulty: 2,
    dataNeeded: ["PMS", "POS", "会計データ", "予算"],
    tools: "BIツール＋生成AI",
  },
  {
    id: "budget",
    departmentId: "management",
    title: "予算策定・シミュレーション",
    pain: "予算や事業計画を前年踏襲で作っており、価格・稼働・人件費の変化による影響を試算しにくい。",
    solution: "需要予測をもとに、価格戦略・人員配置・改装による客室停止などのシナリオ別に売上・利益をシミュレーション。",
    effect: "根拠のある予算策定、投資判断の迅速化",
    impact: 2,
    difficulty: 3,
    dataNeeded: ["過去実績", "需要予測", "コスト構造"],
    tools: "需要予測＋財務モデル",
  },
  {
    id: "market-research",
    departmentId: "management",
    title: "競合・市場調査の効率化",
    pain: "競合ホテルの新プランや周辺開発、インバウンド動向などの情報収集に時間がかかる。",
    solution: "競合のWebサイト・プラン・口コミ、観光統計、ニュースをAIが定期収集・要約し、自館への影響をレポート。",
    effect: "情報収集時間の削減、戦略立案の迅速化",
    impact: 1,
    difficulty: 1,
    dataNeeded: ["公開情報（競合サイト・統計・ニュース）"],
    tools: "生成AI（Web調査・要約）",
  },
];

export const LEVEL_LABEL: Record<Level, string> = { 1: "低", 2: "中", 3: "高" };

// 効果が高く、難易度が低いものほど先に取り組むべき
export function priorityScore(u: UseCase): number {
  return u.impact * 2 - u.difficulty;
}

export const ROADMAP = [
  {
    phase: "STEP 1（〜3か月）",
    title: "すぐ始められる生成AI活用",
    description: "システム連携がほぼ不要で、月額数千円〜の生成AIツールから始められる領域。スタッフのAIへの慣れもここで作る。",
    ids: ["chatbot", "email-reply", "review-reply", "content", "training", "translation"],
  },
  {
    phase: "STEP 2（3〜12か月）",
    title: "PMS・データ連携で効果を広げる",
    description: "PMSや予約データと連携し、需要予測をもとに価格・人員・仕入れを最適化する。収益とコストへの効果が大きい。",
    ids: ["dynamic-pricing", "demand-forecast", "shift", "hk-assign", "fb-forecast", "reporting"],
  },
  {
    phase: "STEP 3（1年〜）",
    title: "設備投資・高度化",
    description: "センサーや設備投資を伴う領域。STEP2で整えたデータ基盤の上に積み上げる。",
    ids: ["energy", "maintenance", "self-checkin", "personalize", "budget"],
  },
];

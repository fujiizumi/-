/**
 * 出店エリアのプリセット。
 *
 * ADR・稼働率・賃料などは「宿泊特化型ホテル（シングル中心）」を想定した
 * 社内検討用の仮の目安です。実際の出店検討では、競合価格の自動取得結果や
 * 物件の賃料条件、最新の最低賃金で上書きしてください。
 */
export type AreaPreset = {
  id: string;
  name: string;
  prefecture: string;
  /** 代表地点（主要駅付近）の緯度・経度（WGS84） */
  lat: number;
  lng: number;
  /** 想定ADR（税抜・円） */
  adr: number;
  /** 想定稼働率（0〜1） */
  occupancy: number;
  /** 最低賃金（円/時）※2025年度改定の目安。最新値で更新してください */
  minWage: number;
  /** 賃料目安（円/室/月） */
  rentPerRoomMonthly: number;
  /** 1室あたり平均人数 */
  guestsPerRoom: number;
  /** OTA販売比率 */
  otaShare: number;
  /** 水道光熱費の係数（寒冷地の暖房費など。省略時 1.0） */
  utilityFactor?: number;
};

export const AREAS: AreaPreset[] = [
  { id: "sapporo", name: "札幌（すすきの・大通）", prefecture: "北海道", lat: 43.0556, lng: 141.3536, adr: 8_500, occupancy: 0.8, minWage: 1_075, rentPerRoomMonthly: 74_000, guestsPerRoom: 1.35, otaShare: 0.62 },
  { id: "wakkanai", name: "稚内（駅・港周辺）", prefecture: "北海道", lat: 45.417, lng: 141.677, adr: 7_800, occupancy: 0.62, minWage: 1_075, rentPerRoomMonthly: 42_000, guestsPerRoom: 1.3, otaShare: 0.5, utilityFactor: 1.4 },
  { id: "sendai", name: "仙台駅周辺", prefecture: "宮城県", lat: 38.2601, lng: 140.8822, adr: 7_800, occupancy: 0.78, minWage: 1_038, rentPerRoomMonthly: 66_000, guestsPerRoom: 1.2, otaShare: 0.58 },
  { id: "tokyo-ueno", name: "東京（上野・浅草）", prefecture: "東京都", lat: 35.7138, lng: 139.7774, adr: 13_000, occupancy: 0.85, minWage: 1_226, rentPerRoomMonthly: 132_000, guestsPerRoom: 1.5, otaShare: 0.7 },
  { id: "tokyo-kamata", name: "東京（蒲田・大森）", prefecture: "東京都", lat: 35.5626, lng: 139.716, adr: 10_500, occupancy: 0.84, minWage: 1_226, rentPerRoomMonthly: 106_000, guestsPerRoom: 1.3, otaShare: 0.66 },
  { id: "yokohama", name: "横浜（関内・桜木町）", prefecture: "神奈川県", lat: 35.4437, lng: 139.6380, adr: 10_000, occupancy: 0.82, minWage: 1_225, rentPerRoomMonthly: 98_000, guestsPerRoom: 1.4, otaShare: 0.65 },
  { id: "chiba", name: "千葉駅周辺", prefecture: "千葉県", lat: 35.6131, lng: 140.1133, adr: 8_000, occupancy: 0.8, minWage: 1_140, rentPerRoomMonthly: 70_000, guestsPerRoom: 1.2, otaShare: 0.55 },
  { id: "nagoya", name: "名古屋（名駅・栄）", prefecture: "愛知県", lat: 35.1709, lng: 136.8815, adr: 9_000, occupancy: 0.8, minWage: 1_140, rentPerRoomMonthly: 82_000, guestsPerRoom: 1.25, otaShare: 0.6 },
  { id: "kanazawa", name: "金沢駅周辺", prefecture: "石川県", lat: 36.5781, lng: 136.6478, adr: 9_500, occupancy: 0.78, minWage: 1_054, rentPerRoomMonthly: 77_000, guestsPerRoom: 1.5, otaShare: 0.68 },
  { id: "kyoto", name: "京都（四条・京都駅）", prefecture: "京都府", lat: 35.0037, lng: 135.7681, adr: 13_500, occupancy: 0.83, minWage: 1_122, rentPerRoomMonthly: 126_000, guestsPerRoom: 1.6, otaShare: 0.75 },
  { id: "osaka-namba", name: "大阪（なんば・心斎橋）", prefecture: "大阪府", lat: 34.6661, lng: 135.5013, adr: 11_000, occupancy: 0.86, minWage: 1_177, rentPerRoomMonthly: 102_000, guestsPerRoom: 1.55, otaShare: 0.72 },
  { id: "osaka-umeda", name: "大阪（梅田・新大阪）", prefecture: "大阪府", lat: 34.7025, lng: 135.4959, adr: 11_500, occupancy: 0.85, minWage: 1_177, rentPerRoomMonthly: 108_000, guestsPerRoom: 1.4, otaShare: 0.68 },
  { id: "kobe", name: "神戸（三宮）", prefecture: "兵庫県", lat: 34.6946, lng: 135.1955, adr: 9_000, occupancy: 0.78, minWage: 1_116, rentPerRoomMonthly: 79_000, guestsPerRoom: 1.4, otaShare: 0.62 },
  { id: "hiroshima", name: "広島駅・紙屋町", prefecture: "広島県", lat: 34.3966, lng: 132.4596, adr: 9_000, occupancy: 0.8, minWage: 1_085, rentPerRoomMonthly: 74_000, guestsPerRoom: 1.45, otaShare: 0.65 },
  { id: "fukuoka", name: "福岡（博多・天神）", prefecture: "福岡県", lat: 33.5902, lng: 130.4207, adr: 10_000, occupancy: 0.84, minWage: 1_057, rentPerRoomMonthly: 90_000, guestsPerRoom: 1.4, otaShare: 0.66 },
  { id: "kumamoto", name: "熊本（市街地）", prefecture: "熊本県", lat: 32.8031, lng: 130.7079, adr: 8_000, occupancy: 0.8, minWage: 1_034, rentPerRoomMonthly: 62_000, guestsPerRoom: 1.3, otaShare: 0.58 },
  { id: "naha", name: "那覇（国際通り）", prefecture: "沖縄県", lat: 26.2155, lng: 127.6855, adr: 10_500, occupancy: 0.8, minWage: 1_023, rentPerRoomMonthly: 84_000, guestsPerRoom: 1.8, otaShare: 0.72 },
  { id: "regional", name: "地方都市（県庁所在地クラス）", prefecture: "—", lat: 36.3911, lng: 139.0608, adr: 7_200, occupancy: 0.76, minWage: 1_050, rentPerRoomMonthly: 58_000, guestsPerRoom: 1.2, otaShare: 0.5 },
];

export const ROOM_PRESETS = [50, 80, 100, 120, 150, 200, 250];

export const findArea = (id: string | undefined) => AREAS.find((a) => a.id === id);

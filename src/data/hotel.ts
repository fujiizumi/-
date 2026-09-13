export type RoomType = {
  id: string;
  name: string;
  capacity: number;
  totalRooms: number;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
};

export type Plan = {
  id: string;
  name: string;
  /** Multiplier applied on top of the room's dynamic price. */
  priceMultiplier: number;
  description: string;
};

export const HOTEL = {
  name: "サンプルホテル東京ベイ",
  location: {
    lat: 35.6432,
    lng: 139.7947,
    area: "東京都江東区（お台場エリア）",
  },
};

export const ROOM_TYPES: RoomType[] = [
  {
    id: "standard-twin",
    name: "スタンダードツイン",
    capacity: 2,
    totalRooms: 40,
    basePrice: 12000,
    minPrice: 7000,
    maxPrice: 32000,
  },
  {
    id: "deluxe-double",
    name: "デラックスダブル",
    capacity: 2,
    totalRooms: 25,
    basePrice: 16000,
    minPrice: 9000,
    maxPrice: 42000,
  },
  {
    id: "suite-bay-view",
    name: "スイート（ベイビュー）",
    capacity: 3,
    totalRooms: 8,
    basePrice: 32000,
    minPrice: 20000,
    maxPrice: 90000,
  },
  {
    id: "family-room",
    name: "ファミリールーム",
    capacity: 4,
    totalRooms: 15,
    basePrice: 22000,
    minPrice: 14000,
    maxPrice: 55000,
  },
];

export const PLANS: Plan[] = [
  {
    id: "room-only",
    name: "素泊まり",
    priceMultiplier: 1.0,
    description: "食事なし・素泊まりプラン",
  },
  {
    id: "breakfast",
    name: "朝食付き",
    priceMultiplier: 1.12,
    description: "和洋朝食ビュッフェ付き",
  },
  {
    id: "half-board",
    name: "1泊2食付き",
    priceMultiplier: 1.35,
    description: "朝食・夕食付きプラン",
  },
  {
    id: "early-bird",
    name: "早期割引（21日前）",
    priceMultiplier: 0.9,
    description: "21日以上前の予約限定割引プラン",
  },
];

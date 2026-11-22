/**
 * 新規ホテル 収支シミュレーター（賃貸方式 / MC方式）
 *
 * 1ホテルあたりの年間営業利益を、客室単価・稼働率・人員配置・各種経費から
 * 積み上げで算出します。すべて純粋関数なので、UIからも検証スクリプトからも
 * 同じロジックを使えます。
 */

export type OperationModel = "lease" | "mc";

export type FullTimeStaff = {
  id: string;
  role: string;
  headcount: number;
  /** 月給（円） */
  monthlySalary: number;
  /** 年間賞与（月給の何か月分） */
  bonusMonths: number;
  /** 通勤交通費（円/月/人） */
  commuteMonthly: number;
};

export type PartTimeStaff = {
  id: string;
  role: string;
  headcount: number;
  /** 時給（円） */
  hourlyWage: number;
  /** 1日あたり労働時間 */
  hoursPerDay: number;
  /** 1人あたり月間勤務日数 */
  daysPerMonth: number;
  /** 通勤交通費（円/日/人） */
  commutePerDay: number;
};

export type SimulationInput = {
  model: OperationModel;
  /** 出店エリア（src/data/areas.ts の id。手入力の場合は "custom"） */
  areaId: string;
  /** 物件所在地（競合検索の中心） */
  latitude: number;
  longitude: number;
  /** 競合ホテルの中央値（税抜換算・円）。未取得なら null */
  marketAdr: number | null;
  /** 目標営業利益（円/年） */
  targetProfit: number;

  // --- 売上 ---
  rooms: number;
  operatingDays: number;
  /** 稼働率（0〜1） */
  occupancy: number;
  /** 客室単価 ADR（円/販売室） */
  adr: number;
  /** 1室あたり平均宿泊人数 */
  guestsPerRoom: number;
  /** 朝食単価（円/人） */
  breakfastPrice: number;
  /** 朝食喫食率（宿泊者に対する割合 0〜1） */
  breakfastRate: number;
  /** その他付帯売上（円/販売室：自販機・駐車場・コインランドリー等） */
  otherRevenuePerRoom: number;

  // --- 売上原価・販売手数料 ---
  /** 朝食原価率（0〜1） */
  breakfastCostRate: number;
  /** その他付帯売上の原価率（0〜1） */
  otherCostRate: number;
  /** OTA経由の販売比率（客室売上に対する割合 0〜1） */
  otaShare: number;
  /** OTA手数料率（0〜1） */
  otaCommission: number;
  /** カード等決済手数料率（総売上に対する 0〜1） */
  paymentFeeRate: number;

  // --- 人件費 ---
  fullTime: FullTimeStaff[];
  partTime: PartTimeStaff[];
  /** 客室清掃：1室あたり清掃時間（h） */
  cleaningHoursPerRoom: number;
  /** 客室清掃：時給（円） */
  cleaningHourlyWage: number;
  /** 客室清掃：1人1日あたり労働時間（交通費計算用） */
  cleaningShiftHours: number;
  /** 客室清掃：通勤交通費（円/日/人） */
  cleaningCommutePerDay: number;
  /** 清掃外注単価（円/販売室。外注する場合。自社パートと併用可） */
  cleaningOutsourcePerRoom: number;
  /** 法定福利費率：正社員（給与＋賞与に対する 0〜1） */
  welfareRateFullTime: number;
  /** 法定福利費率：パート・アルバイト（0〜1） */
  welfareRatePartTime: number;

  // --- 変動費（販売室あたり） ---
  /** 水道光熱費（変動分：円/販売室） */
  utilitiesPerRoom: number;
  /** 備品消耗品・アメニティ（円/販売室） */
  suppliesPerRoom: number;
  /** 洗濯リネン費（円/販売室） */
  linenPerRoom: number;

  // --- 固定費（円/月） ---
  utilitiesFixedMonthly: number;
  systemMonthly: number;
  repairMonthly: number;
  otherFixedMonthly: number;
  /** 広告宣伝費率（総売上に対する 0〜1） */
  advertisingRate: number;

  // --- 賃貸方式 ---
  /** 固定賃料（円/月） */
  leaseFixedRentMonthly: number;
  /** 変動賃料率（総売上に対する 0〜1） */
  leaseVariableRentRate: number;
  /** 損害保険料など運営者負担の固定費（円/月） */
  leaseInsuranceMonthly: number;
  /** 開業時投資（FF&E・開業費 等：円） */
  leaseInitialInvestment: number;
  /** 償却年数（年） */
  leaseDepreciationYears: number;

  // --- MC（マネジメントコントラクト）方式 ---
  /** ベースフィー率（総売上に対する 0〜1） */
  mcBaseFeeRate: number;
  /** インセンティブフィー率（GOPに対する 0〜1） */
  mcIncentiveFeeRate: number;
  /** 運営会社側の負担コスト（本部経費・派遣人員等：円/月） */
  mcOperatorCostMonthly: number;
  /** オーナー負担の固定費（固定資産税・保険・建物償却等：円/月） */
  mcOwnerFixedMonthly: number;
};

export type LineItem = {
  key: string;
  label: string;
  group: "revenue" | "cogs" | "labor" | "expense" | "model";
  amount: number;
  note?: string;
};

export type SimulationResult = {
  // KPI
  availableRoomNights: number;
  soldRoomNights: number;
  guestNights: number;
  adr: number;
  /** 客単価（宿泊者1人あたり客室売上） */
  revenuePerGuest: number;
  /** 客単価（朝食・付帯込み） */
  totalSpendPerGuest: number;
  occupancy: number;
  revPar: number;
  /** 総売上 ÷ 販売可能室数 */
  trevPar: number;

  // P&L
  roomRevenue: number;
  breakfastRevenue: number;
  otherRevenue: number;
  totalRevenue: number;

  cogs: number;
  grossProfit: number;

  fullTimeSalary: number;
  fullTimeBonus: number;
  partTimeWages: number;
  cleaningWages: number;
  cleaningOutsource: number;
  welfare: number;
  commute: number;
  laborTotal: number;
  /** パート・清掃の年間総労働時間 */
  partTimeHours: number;

  operatingExpenses: number;
  /** GOP（賃料・フィー控除前の営業総利益） */
  gop: number;
  gopRate: number;

  // 方式別
  lease: {
    rent: number;
    insurance: number;
    depreciation: number;
    operatingProfit: number;
  };
  mc: {
    baseFee: number;
    incentiveFee: number;
    operatorCost: number;
    /** 運営会社の営業利益 */
    operatorProfit: number;
    /** オーナー（ホテル）の営業利益 */
    ownerProfit: number;
  };

  /** 選択中の方式における「自社の営業利益」 */
  operatingProfit: number;
  operatingProfitRate: number;
  targetGap: number;
  achieved: boolean;

  lines: LineItem[];
  /** 販売1室あたりの運営コスト（CPOR：賃料・フィー除く） */
  costPerOccupiedRoom: number;
  /** 正社員＋パートの人件費率 */
  laborRate: number;
};

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export function simulate(input: SimulationInput): SimulationResult {
  const i = input;
  const occupancy = clamp(i.occupancy, 0, 1);
  const availableRoomNights = i.rooms * i.operatingDays;
  const soldRoomNights = availableRoomNights * occupancy;
  const guestNights = soldRoomNights * i.guestsPerRoom;
  const months = i.operatingDays / (365 / 12);

  // 売上
  const roomRevenue = soldRoomNights * i.adr;
  const breakfastRevenue = guestNights * i.breakfastRate * i.breakfastPrice;
  const otherRevenue = soldRoomNights * i.otherRevenuePerRoom;
  const totalRevenue = roomRevenue + breakfastRevenue + otherRevenue;

  // 売上原価（料飲原価＋送客・決済手数料）
  const breakfastCost = breakfastRevenue * i.breakfastCostRate;
  const otherCost = otherRevenue * i.otherCostRate;
  const otaFee = roomRevenue * i.otaShare * i.otaCommission;
  const paymentFee = totalRevenue * i.paymentFeeRate;
  const cogs = breakfastCost + otherCost + otaFee + paymentFee;
  const grossProfit = totalRevenue - cogs;

  // 人件費
  const fullTimeSalary = sum(i.fullTime.map((s) => s.headcount * s.monthlySalary * months));
  const fullTimeBonus = sum(i.fullTime.map((s) => s.headcount * s.monthlySalary * s.bonusMonths));
  const fullTimeCommute = sum(i.fullTime.map((s) => s.headcount * s.commuteMonthly * months));

  const partShifts = sum(i.partTime.map((p) => p.headcount * p.daysPerMonth * months));
  const partHoursFixed = sum(i.partTime.map((p) => p.headcount * p.hoursPerDay * p.daysPerMonth * months));
  const partTimeWages = sum(
    i.partTime.map((p) => p.headcount * p.hourlyWage * p.hoursPerDay * p.daysPerMonth * months),
  );
  const partTimeCommute = sum(i.partTime.map((p) => p.headcount * p.commutePerDay * p.daysPerMonth * months));

  const cleaningHours = soldRoomNights * i.cleaningHoursPerRoom;
  const cleaningWages = cleaningHours * i.cleaningHourlyWage;
  const cleaningShifts = i.cleaningShiftHours > 0 ? cleaningHours / i.cleaningShiftHours : 0;
  const cleaningCommute = cleaningShifts * i.cleaningCommutePerDay;
  const cleaningOutsource = soldRoomNights * i.cleaningOutsourcePerRoom;

  const welfare =
    (fullTimeSalary + fullTimeBonus) * i.welfareRateFullTime +
    (partTimeWages + cleaningWages) * i.welfareRatePartTime;
  const commute = fullTimeCommute + partTimeCommute + cleaningCommute;
  const laborTotal =
    fullTimeSalary + fullTimeBonus + partTimeWages + cleaningWages + cleaningOutsource + welfare + commute;

  // 経費
  const utilities = soldRoomNights * i.utilitiesPerRoom + i.utilitiesFixedMonthly * months;
  const supplies = soldRoomNights * i.suppliesPerRoom;
  const linen = soldRoomNights * i.linenPerRoom;
  const system = i.systemMonthly * months;
  const repair = i.repairMonthly * months;
  const advertising = totalRevenue * i.advertisingRate;
  const otherFixed = i.otherFixedMonthly * months;
  const operatingExpenses = utilities + supplies + linen + system + repair + advertising + otherFixed;

  const gop = grossProfit - laborTotal - operatingExpenses;

  // 賃貸方式：運営会社がホテル収支を丸ごと負い、賃料を払う
  const rent = i.leaseFixedRentMonthly * months + totalRevenue * i.leaseVariableRentRate;
  const insurance = i.leaseInsuranceMonthly * months;
  const depreciation =
    i.leaseDepreciationYears > 0 ? (i.leaseInitialInvestment / i.leaseDepreciationYears) * (months / 12) : 0;
  const leaseProfit = gop - rent - insurance - depreciation;

  // MC方式：ホテル収支はオーナー帰属、運営会社はフィー収入から自社コストを引いたものが利益
  const baseFee = totalRevenue * i.mcBaseFeeRate;
  const incentiveFee = Math.max(0, gop - baseFee) * i.mcIncentiveFeeRate;
  const operatorCost = i.mcOperatorCostMonthly * months;
  const operatorProfit = baseFee + incentiveFee - operatorCost;
  const ownerProfit = gop - baseFee - incentiveFee - i.mcOwnerFixedMonthly * months;

  const operatingProfit = i.model === "lease" ? leaseProfit : operatorProfit;
  const profitBase = i.model === "lease" ? totalRevenue : baseFee + incentiveFee;

  const lines: LineItem[] = [
    { key: "room", label: "客室売上", group: "revenue", amount: roomRevenue },
    { key: "breakfast", label: "朝食売上", group: "revenue", amount: breakfastRevenue },
    { key: "other", label: "その他付帯売上", group: "revenue", amount: otherRevenue },
    { key: "bfCost", label: "朝食原価", group: "cogs", amount: breakfastCost },
    { key: "otherCost", label: "付帯売上原価", group: "cogs", amount: otherCost },
    { key: "ota", label: "OTA手数料", group: "cogs", amount: otaFee },
    { key: "payment", label: "決済手数料", group: "cogs", amount: paymentFee },
    { key: "ftSalary", label: "正社員 給与", group: "labor", amount: fullTimeSalary },
    { key: "ftBonus", label: "正社員 賞与", group: "labor", amount: fullTimeBonus },
    { key: "ptWages", label: "パート・アルバイト給与", group: "labor", amount: partTimeWages, note: `${Math.round(partHoursFixed).toLocaleString()}時間/年` },
    { key: "cleaning", label: "客室清掃パート給与", group: "labor", amount: cleaningWages, note: `${Math.round(cleaningHours).toLocaleString()}時間/年` },
    { key: "outsource", label: "清掃外注費", group: "labor", amount: cleaningOutsource },
    { key: "welfare", label: "法定福利費", group: "labor", amount: welfare },
    { key: "commute", label: "通勤交通費", group: "labor", amount: commute, note: `パート延べ${Math.round(partShifts + cleaningShifts).toLocaleString()}シフト` },
    { key: "utilities", label: "水道光熱費", group: "expense", amount: utilities },
    { key: "supplies", label: "備品消耗品・アメニティ", group: "expense", amount: supplies },
    { key: "linen", label: "洗濯リネン費", group: "expense", amount: linen },
    { key: "system", label: "通信・システム費", group: "expense", amount: system },
    { key: "repair", label: "修繕費", group: "expense", amount: repair },
    { key: "ad", label: "広告宣伝費", group: "expense", amount: advertising },
    { key: "otherFixed", label: "その他経費", group: "expense", amount: otherFixed },
  ];

  if (i.model === "lease") {
    lines.push(
      { key: "rent", label: "賃料（固定＋変動）", group: "model", amount: rent },
      { key: "insurance", label: "保険料等", group: "model", amount: insurance },
      { key: "dep", label: "減価償却費（開業投資）", group: "model", amount: depreciation },
    );
  } else {
    lines.push(
      { key: "baseFee", label: "ベースフィー（オーナー→運営会社）", group: "model", amount: baseFee },
      { key: "incentiveFee", label: "インセンティブフィー", group: "model", amount: incentiveFee },
      { key: "ownerFixed", label: "オーナー負担固定費", group: "model", amount: i.mcOwnerFixedMonthly * months },
    );
  }

  return {
    availableRoomNights,
    soldRoomNights,
    guestNights,
    adr: i.adr,
    revenuePerGuest: i.guestsPerRoom > 0 ? i.adr / i.guestsPerRoom : 0,
    totalSpendPerGuest: guestNights > 0 ? totalRevenue / guestNights : 0,
    occupancy,
    revPar: i.adr * occupancy,
    trevPar: availableRoomNights > 0 ? totalRevenue / availableRoomNights : 0,
    roomRevenue,
    breakfastRevenue,
    otherRevenue,
    totalRevenue,
    cogs,
    grossProfit,
    fullTimeSalary,
    fullTimeBonus,
    partTimeWages,
    cleaningWages,
    cleaningOutsource,
    welfare,
    commute,
    laborTotal,
    partTimeHours: partHoursFixed + cleaningHours,
    operatingExpenses,
    gop,
    gopRate: totalRevenue > 0 ? gop / totalRevenue : 0,
    lease: { rent, insurance, depreciation, operatingProfit: leaseProfit },
    mc: { baseFee, incentiveFee, operatorCost, operatorProfit, ownerProfit },
    operatingProfit,
    operatingProfitRate: profitBase > 0 ? operatingProfit / profitBase : 0,
    targetGap: operatingProfit - i.targetProfit,
    achieved: operatingProfit >= i.targetProfit,
    lines,
    costPerOccupiedRoom: soldRoomNights > 0 ? (cogs + laborTotal + operatingExpenses) / soldRoomNights : 0,
    laborRate: totalRevenue > 0 ? laborTotal / totalRevenue : 0,
  };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** 二分探索で「目標利益を達成する最小値」を求める（利益が単調増加である前提） */
function solveMin(fn: (x: number) => number, target: number, lo: number, hi: number): number | null {
  if (fn(hi) < target) return null;
  if (fn(lo) >= target) return lo;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) >= target) hi = mid;
    else lo = mid;
  }
  return hi;
}

export type Requirements = {
  /** 現在のADRのまま必要な稼働率 */
  occupancyNeeded: number | null;
  /** 現在の稼働率のまま必要なADR */
  adrNeeded: number | null;
  /** 損益分岐稼働率（営業利益0） */
  breakEvenOccupancy: number | null;
  /** 目標達成に必要なRevPAR（現ADR前提） */
  revParNeeded: number | null;
  /** 人件費・経費をあと何円削減すれば達成か（0なら達成済み） */
  costReductionNeeded: number;
};

export function computeRequirements(input: SimulationInput): Requirements {
  const profitAt = (patch: Partial<SimulationInput>) => simulate({ ...input, ...patch }).operatingProfit;
  const occupancyNeeded = solveMin((o) => profitAt({ occupancy: o }), input.targetProfit, 0, 1);
  const adrNeeded = solveMin((a) => profitAt({ adr: a }), input.targetProfit, 0, 200000);
  const breakEvenOccupancy = solveMin((o) => profitAt({ occupancy: o }), 0, 0, 1);
  const current = simulate(input);
  return {
    occupancyNeeded,
    adrNeeded,
    breakEvenOccupancy,
    revParNeeded: occupancyNeeded !== null ? occupancyNeeded * input.adr : null,
    costReductionNeeded: Math.max(0, input.targetProfit - current.operatingProfit),
  };
}

/** 稼働率 × ADR の感応度マトリクス */
export function sensitivityMatrix(
  input: SimulationInput,
  occDeltas: number[],
  adrFactors: number[],
): { occupancy: number; cells: { adr: number; profit: number }[] }[] {
  return occDeltas.map((d) => {
    const occupancy = clamp(input.occupancy + d, 0, 1);
    return {
      occupancy,
      cells: adrFactors.map((f) => {
        const adr = Math.round((input.adr * f) / 100) * 100;
        return { adr, profit: simulate({ ...input, occupancy, adr }).operatingProfit };
      }),
    };
  });
}

let idSeq = 0;
export const newId = () => `r${Date.now().toString(36)}${(idSeq++).toString(36)}`;

/** 初期値：地方都市・100室規模の宿泊特化型ホテル（朝食あり）想定 */
export const DEFAULT_INPUT: SimulationInput = {
  model: "lease",
  areaId: "custom",
  latitude: 36.3911,
  longitude: 139.0608,
  marketAdr: null,
  targetProfit: 15_000_000,

  rooms: 100,
  operatingDays: 365,
  occupancy: 0.78,
  adr: 8_000,
  guestsPerRoom: 1.3,
  breakfastPrice: 1_200,
  breakfastRate: 0.4,
  otherRevenuePerRoom: 150,

  breakfastCostRate: 0.35,
  otherCostRate: 0.3,
  otaShare: 0.6,
  otaCommission: 0.12,
  paymentFeeRate: 0.02,

  fullTime: [
    { id: "ft1", role: "支配人", headcount: 1, monthlySalary: 450_000, bonusMonths: 2, commuteMonthly: 15_000 },
    { id: "ft2", role: "副支配人", headcount: 1, monthlySalary: 330_000, bonusMonths: 2, commuteMonthly: 15_000 },
    { id: "ft3", role: "フロント社員", headcount: 3, monthlySalary: 250_000, bonusMonths: 2, commuteMonthly: 12_000 },
  ],
  partTime: [
    { id: "pt1", role: "フロント（日勤）", headcount: 4, hourlyWage: 1_150, hoursPerDay: 6, daysPerMonth: 18, commutePerDay: 500 },
    { id: "pt2", role: "フロント（夜勤）", headcount: 2, hourlyWage: 1_350, hoursPerDay: 9, daysPerMonth: 15, commutePerDay: 500 },
    { id: "pt3", role: "朝食スタッフ", headcount: 3, hourlyWage: 1_100, hoursPerDay: 4, daysPerMonth: 20, commutePerDay: 400 },
  ],
  cleaningHoursPerRoom: 0.5,
  cleaningHourlyWage: 1_150,
  cleaningShiftHours: 5,
  cleaningCommutePerDay: 400,
  cleaningOutsourcePerRoom: 0,
  welfareRateFullTime: 0.155,
  welfareRatePartTime: 0.06,

  utilitiesPerRoom: 280,
  suppliesPerRoom: 180,
  linenPerRoom: 380,

  utilitiesFixedMonthly: 500_000,
  systemMonthly: 150_000,
  repairMonthly: 200_000,
  otherFixedMonthly: 250_000,
  advertisingRate: 0.01,

  leaseFixedRentMonthly: 7_800_000,
  leaseVariableRentRate: 0,
  leaseInsuranceMonthly: 80_000,
  leaseInitialInvestment: 30_000_000,
  leaseDepreciationYears: 5,

  mcBaseFeeRate: 0.03,
  mcIncentiveFeeRate: 0.08,
  mcOperatorCostMonthly: 300_000,
  mcOwnerFixedMonthly: 2_500_000,
};

/**
 * エリアの相場と客室数から、人員配置・賃料・固定費などの標準値を組み立てる。
 * 目標利益・原価率・フィー率など、エリアや規模に依存しない条件は base から引き継ぐ。
 */
export function buildInputForArea(
  area: {
    id: string;
    lat: number;
    lng: number;
    adr: number;
    occupancy: number;
    minWage: number;
    rentPerRoomMonthly: number;
    guestsPerRoom: number;
    otaShare: number;
    utilityFactor?: number;
  },
  rooms: number,
  base: SimulationInput,
): SimulationInput {
  const r = Math.max(1, Math.round(rooms));
  const w = area.minWage;
  const salaryFactor = w / 1_100;
  const round1000 = (v: number) => Math.round(v / 1000) * 1000;
  const round10 = (v: number) => Math.round(v / 10) * 10;

  const fullTime: FullTimeStaff[] = [
    { id: newId(), role: "支配人", headcount: 1, monthlySalary: round1000(450_000 * salaryFactor), bonusMonths: 2, commuteMonthly: 15_000 },
  ];
  if (r >= 80) {
    fullTime.push({ id: newId(), role: "副支配人", headcount: 1, monthlySalary: round1000(330_000 * salaryFactor), bonusMonths: 2, commuteMonthly: 15_000 });
  }
  fullTime.push({
    id: newId(),
    role: "フロント社員",
    headcount: Math.max(1, Math.round(r / 35)),
    monthlySalary: round1000(250_000 * salaryFactor),
    bonusMonths: 2,
    commuteMonthly: 12_000,
  });

  const partTime: PartTimeStaff[] = [
    { id: newId(), role: "フロント（日勤）", headcount: Math.max(2, Math.ceil(r / 25)), hourlyWage: round10(w + 70), hoursPerDay: 6, daysPerMonth: 18, commutePerDay: 500 },
    { id: newId(), role: "フロント（夜勤）", headcount: r > 150 ? 3 : 2, hourlyWage: round10(w + 250), hoursPerDay: 9, daysPerMonth: 15, commutePerDay: 500 },
    { id: newId(), role: "朝食スタッフ", headcount: Math.max(1, Math.ceil(r / 35)), hourlyWage: round10(w + 30), hoursPerDay: 4, daysPerMonth: 20, commutePerDay: 400 },
  ];

  return {
    ...base,
    areaId: area.id,
    latitude: area.lat,
    longitude: area.lng,
    marketAdr: null,
    rooms: r,
    adr: area.adr,
    occupancy: area.occupancy,
    guestsPerRoom: area.guestsPerRoom,
    otaShare: area.otaShare,
    fullTime,
    partTime,
    cleaningHourlyWage: round10(w + 70),
    utilitiesFixedMonthly: Math.round(5_000 * r * (area.utilityFactor ?? 1)),
    utilitiesPerRoom: Math.round(DEFAULT_INPUT.utilitiesPerRoom * (area.utilityFactor ?? 1)),
    systemMonthly: 80_000 + 700 * r,
    repairMonthly: 2_000 * r,
    otherFixedMonthly: 2_500 * r,
    leaseFixedRentMonthly: area.rentPerRoomMonthly * r,
    leaseInsuranceMonthly: 800 * r,
    leaseInitialInvestment: 300_000 * r,
    mcOperatorCostMonthly: 200_000 + 1_000 * r,
    mcOwnerFixedMonthly: 25_000 * r,
  };
}

export type BreakEvenAnalysis = {
  /** 計算方法：賃貸は固定費・変動費に分けるCVP分析、MCはフィー体系が非線形のため数値計算 */
  method: "cvp" | "numeric";
  /** 固定費（年） */
  fixedCosts: number;
  /** 変動費率（変動費 ÷ 売上高）。MCは null */
  variableCostRatio: number | null;
  /** 限界利益率（1 − 変動費率）。MCは null */
  contributionMarginRatio: number | null;
  /** 損益分岐点売上高（年）。客室数の上限で届かない場合も理論値を返す（MCで届かない場合は null） */
  breakEvenSales: number | null;
  /** 目標営業利益を達成する売上高（年） */
  targetSales: number | null;
  /** 損益分岐点稼働率（ADR据置。1を超える場合は満室でも届かない） */
  breakEvenOccupancy: number | null;
  /** 安全余裕率（(現在売上 − 損益分岐点売上) ÷ 現在売上） */
  safetyMargin: number | null;
  /** 損益分岐点比率（損益分岐点売上 ÷ 現在売上） */
  breakEvenRatio: number | null;
  /** 満室時の売上高（年） */
  maxSales: number;
  /** MC方式：オーナー（ホテル）の損益分岐点売上高 */
  ownerBreakEvenSales?: number | null;
};

/**
 * 損益分岐点分析。
 * 稼働率（販売室数）だけを動かしたとき、売上高と費用はいずれも販売室数に比例する部分と
 * 固定部分に分かれる。賃貸方式では営業利益が売上高の一次関数になるので、
 * 稼働率0%と100%の2点から固定費と変動費率を求め、
 *   損益分岐点売上高 = 固定費 ÷ 限界利益率
 * で計算する（ADR・人数・喫食率などの売上構成は現在の入力のまま）。
 */
export function breakEvenAnalysis(input: SimulationInput): BreakEvenAnalysis {
  const current = simulate(input);
  const at = (occupancy: number) => simulate({ ...input, occupancy });
  const full = at(1);
  const maxSales = full.totalRevenue;
  const salesPerOcc = maxSales; // 売上高は稼働率に比例

  const ratioOf = (be: number | null) => (be !== null && current.totalRevenue > 0 ? be / current.totalRevenue : null);
  const marginOf = (be: number | null) => (be !== null && current.totalRevenue > 0 ? (current.totalRevenue - be) / current.totalRevenue : null);

  if (input.model === "lease") {
    const fixedCosts = -at(0).lease.operatingProfit;
    const variableCosts = full.totalRevenue - full.lease.operatingProfit - fixedCosts;
    const v = full.totalRevenue > 0 ? variableCosts / full.totalRevenue : 0;
    const cm = 1 - v;
    const be = cm > 0 ? Math.max(0, fixedCosts) / cm : null;
    const target = cm > 0 ? Math.max(0, fixedCosts + input.targetProfit) / cm : null;
    return {
      method: "cvp",
      fixedCosts,
      variableCostRatio: v,
      contributionMarginRatio: cm,
      breakEvenSales: be,
      targetSales: target,
      breakEvenOccupancy: be !== null && salesPerOcc > 0 ? be / salesPerOcc : null,
      safetyMargin: marginOf(be),
      breakEvenRatio: ratioOf(be),
      maxSales,
    };
  }

  // MC：運営会社の利益 = ベースフィー + インセンティブフィー − 自社負担コスト（GOPに依存して折れ線になる）
  const solveSales = (fn: (o: number) => number, target: number) => {
    const occ = solveMin(fn, target, 0, 1);
    return occ === null ? null : occ * salesPerOcc;
  };
  const be = solveSales((o) => at(o).mc.operatorProfit, 0);
  const target = solveSales((o) => at(o).mc.operatorProfit, input.targetProfit);
  const ownerBe = solveSales((o) => at(o).mc.ownerProfit, 0);
  return {
    method: "numeric",
    fixedCosts: current.mc.operatorCost,
    variableCostRatio: null,
    contributionMarginRatio: null,
    breakEvenSales: be,
    targetSales: target,
    breakEvenOccupancy: be !== null && salesPerOcc > 0 ? be / salesPerOcc : null,
    safetyMargin: marginOf(be),
    breakEvenRatio: ratioOf(be),
    maxSales,
    ownerBreakEvenSales: ownerBe,
  };
}

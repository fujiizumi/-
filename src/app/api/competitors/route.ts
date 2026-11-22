import { NextResponse } from "next/server";
import { fetchCompetitors } from "@/lib/competitors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  const radiusKm = parseFloat(searchParams.get("radius") ?? "1");
  const checkinDate = searchParams.get("checkin") ?? "";
  const refAdr = parseFloat(searchParams.get("refAdr") ?? "8000");

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "緯度・経度が不正です" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkinDate)) {
    return NextResponse.json({ error: "チェックイン日は YYYY-MM-DD 形式で指定してください" }, { status: 400 });
  }

  const result = await fetchCompetitors({
    lat,
    lng,
    radiusKm: Number.isFinite(radiusKm) ? Math.min(3, Math.max(0.1, radiusKm)) : 1,
    checkinDate,
    refAdr: Number.isFinite(refAdr) && refAdr > 0 ? refAdr : 8000,
  });
  return NextResponse.json(result);
}

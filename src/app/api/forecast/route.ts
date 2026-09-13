import { NextRequest, NextResponse } from "next/server";
import { PLANS, ROOM_TYPES } from "@/data/hotel";
import { recommendPrice } from "@/lib/pricingEngine";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(60, Math.max(1, Number(searchParams.get("days") ?? 30)));
  const roomTypeId = searchParams.get("roomTypeId");
  const planId = searchParams.get("planId");

  const rooms = roomTypeId ? ROOM_TYPES.filter((r) => r.id === roomTypeId) : ROOM_TYPES;
  const plans = planId ? PLANS.filter((p) => p.id === planId) : PLANS;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    for (const room of rooms) {
      for (const plan of plans) {
        results.push(recommendPrice(date, room, plan));
      }
    }
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), count: results.length, results });
}

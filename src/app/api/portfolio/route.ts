import { NextRequest, NextResponse } from "next/server";
import { recommendPortfolioForDate } from "@/lib/pricingEngine";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(60, Math.max(1, Number(searchParams.get("days") ?? 30)));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const results = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    results.push(recommendPortfolioForDate(date));
  }

  return NextResponse.json({ generatedAt: new Date().toISOString(), results });
}

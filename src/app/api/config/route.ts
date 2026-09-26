import { NextResponse } from "next/server";
import { paymentFeePercent } from "@/lib/payment-fee";

export async function GET() {
  return NextResponse.json({ paymentFeePercent: paymentFeePercent() });
}

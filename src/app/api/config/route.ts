import { NextResponse } from "next/server";
import { directChargeLimits } from "@/lib/chapa";
import { paymentFeePercent } from "@/lib/payment-fee";

export async function GET() {
  return NextResponse.json({
    paymentFeePercent: paymentFeePercent(),
    directPayment: {
      telebirr: directChargeLimits("telebirr"),
      cbebirr: directChargeLimits("cbebirr"),
    },
  });
}

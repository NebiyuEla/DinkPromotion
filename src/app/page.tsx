import { LocalizedMiniAppV2 } from "@/components/LocalizedMiniAppV2";
import { PaymentFeeEnhancer } from "@/components/PaymentFeeEnhancer";
import { ServiceFavorites } from "@/components/ServiceFavorites";

export default function Page() {
  return (
    <>
      <LocalizedMiniAppV2 />
      <PaymentFeeEnhancer />
      <ServiceFavorites />
    </>
  );
}

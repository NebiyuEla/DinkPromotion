import { LocalizedMiniAppV2 } from "@/components/LocalizedMiniAppV2";
import { PaymentFeeEnhancer } from "@/components/PaymentFeeEnhancer";
import { FavoritesEnhancer } from "@/components/FavoritesEnhancer";

export default function Page() {
  return (
    <>
      <LocalizedMiniAppV2 />
      <PaymentFeeEnhancer />
      <FavoritesEnhancer />
    </>
  );
}

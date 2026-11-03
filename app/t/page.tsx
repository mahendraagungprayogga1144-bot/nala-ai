import { getHenimaSalesApkUrl } from "@/lib/henima-tracking/field-app";
import SalesAppHome from "./sales-app-home";

/** Pintu app lapangan — tanpa jalan masuk ke dashboard Gercep OS. */
export default function TrackingSalesAppEntry() {
  return <SalesAppHome apkUrl={getHenimaSalesApkUrl()} />;
}

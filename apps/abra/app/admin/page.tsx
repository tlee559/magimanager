import { AdminApp } from "@magimanager/features/admin";
import { APP_VERSION, BUILD_SHA, KADABRA_URL } from "@/lib/constants";

export default function AdminPage() {
  return (
    <AdminApp
      appVersion={APP_VERSION}
      buildSha={BUILD_SHA}
      kadabraUrl={KADABRA_URL}
    />
  );
}

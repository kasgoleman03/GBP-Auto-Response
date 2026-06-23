import { RequireConnection } from "@/components/RequireConnection";
import { ApprovalScreen } from "@/components/screens/ApprovalScreen";

export default function ReviewPage() {
  return (
    <RequireConnection>
      <ApprovalScreen />
    </RequireConnection>
  );
}

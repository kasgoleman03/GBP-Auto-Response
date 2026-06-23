import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./AppLayout";
import { useAppData } from "./AppDataProvider";
import { InboxScreen } from "@/screens/InboxScreen";
import { ApprovalScreen } from "@/screens/ApprovalScreen";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { RulesScreen } from "@/screens/RulesScreen";
import { VoiceScreen } from "@/screens/VoiceScreen";
import { ActivityScreen } from "@/screens/ActivityScreen";
import { Spinner } from "@/components/ui/Button";

/** Gate the app behind a connected Google Business Profile. */
function RequireConnection({ children }: { children: React.ReactNode }) {
  const { connection, loading } = useAppData();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-brand-600">
        <Spinner size={28} />
      </div>
    );
  }
  if (connection?.status !== "connected") {
    return <Navigate to="/connect" replace />;
  }
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: "/connect", element: <OnboardingScreen /> },
  {
    path: "/",
    element: (
      <RequireConnection>
        <AppLayout />
      </RequireConnection>
    ),
    children: [
      { index: true, element: <Navigate to="/inbox" replace /> },
      { path: "inbox", element: <InboxScreen /> },
      { path: "rules", element: <RulesScreen /> },
      { path: "voice", element: <VoiceScreen /> },
      { path: "activity", element: <ActivityScreen /> },
    ],
  },
  {
    path: "/review/:reviewId",
    element: (
      <RequireConnection>
        <ApprovalScreen />
      </RequireConnection>
    ),
  },
  { path: "*", element: <Navigate to="/inbox" replace /> },
]);

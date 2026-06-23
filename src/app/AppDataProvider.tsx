import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/mockApi";
import type { Connection, Draft, Review } from "@/lib/types";

interface AppData {
  connection: Connection | null;
  reviews: Review[];
  drafts: Record<string, Draft>;
  loading: boolean;
  /** Count of reviews still awaiting the owner — drives the nav badge. */
  needsReviewCount: number;

  refresh: () => Promise<void>;
  getDraft: (reviewId: string) => Promise<Draft | undefined>;
  regenerateDraft: (reviewId: string) => Promise<Draft>;
  saveDraft: (reviewId: string, text: string) => Promise<Draft>;
  approveAndPost: (reviewId: string, text?: string) => Promise<void>;
  postOwnReply: (reviewId: string, text: string) => Promise<void>;
  skipReview: (reviewId: string) => Promise<void>;
  connectGoogle: (input: {
    businessName: string;
    locationAddress: string;
    googleAccountEmail: string;
  }) => Promise<void>;
  disconnect: () => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [conn, revs] = await Promise.all([
      api.getConnection(),
      api.listReviews(),
    ]);
    setConnection(conn);
    setReviews(revs);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setDraft = useCallback((draft: Draft) => {
    setDrafts((prev) => ({ ...prev, [draft.reviewId]: draft }));
  }, []);

  const getDraft = useCallback(
    async (reviewId: string) => {
      const cached = drafts[reviewId];
      if (cached) return cached;
      const fetched = await api.getDraft(reviewId);
      if (fetched) setDraft(fetched);
      return fetched;
    },
    [drafts, setDraft]
  );

  const regenerateDraft = useCallback(
    async (reviewId: string) => {
      const draft = await api.regenerateDraft(reviewId);
      setDraft(draft);
      return draft;
    },
    [setDraft]
  );

  const saveDraft = useCallback(
    async (reviewId: string, text: string) => {
      const draft = await api.saveDraft(reviewId, text);
      setDraft(draft);
      return draft;
    },
    [setDraft]
  );

  const applyResult = useCallback(
    (result: { review: Review; draft: Draft }) => {
      setReviews((prev) =>
        prev.map((r) => (r.id === result.review.id ? result.review : r))
      );
      setDraft(result.draft);
    },
    [setDraft]
  );

  const approveAndPost = useCallback(
    async (reviewId: string, text?: string) => {
      const result = await api.approveAndPost(reviewId, text);
      applyResult(result);
    },
    [applyResult]
  );

  const postOwnReply = useCallback(
    async (reviewId: string, text: string) => {
      const result = await api.postOwnReply(reviewId, text);
      applyResult(result);
    },
    [applyResult]
  );

  const skipReview = useCallback(async (reviewId: string) => {
    const review = await api.skipReview(reviewId);
    setReviews((prev) => prev.map((r) => (r.id === review.id ? review : r)));
  }, []);

  const connectGoogle = useCallback(
    async (input: {
      businessName: string;
      locationAddress: string;
      googleAccountEmail: string;
    }) => {
      const conn = await api.connectGoogle(input);
      setConnection(conn);
      await refresh();
    },
    [refresh]
  );

  const disconnect = useCallback(async () => {
    const conn = await api.disconnect();
    setConnection(conn);
  }, []);

  const needsReviewCount = useMemo(
    () => reviews.filter((r) => r.status === "needs_review").length,
    [reviews]
  );

  const value = useMemo<AppData>(
    () => ({
      connection,
      reviews,
      drafts,
      loading,
      needsReviewCount,
      refresh,
      getDraft,
      regenerateDraft,
      saveDraft,
      approveAndPost,
      postOwnReply,
      skipReview,
      connectGoogle,
      disconnect,
    }),
    [
      connection,
      reviews,
      drafts,
      loading,
      needsReviewCount,
      refresh,
      getDraft,
      regenerateDraft,
      saveDraft,
      approveAndPost,
      postOwnReply,
      skipReview,
      connectGoogle,
      disconnect,
    ]
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx)
    throw new Error("useAppData must be used within an AppDataProvider");
  return ctx;
}

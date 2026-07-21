import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, FileText, Loader2, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionHeader, Sticker } from "@/components/camp/CampDesign";
import { getActiveCampSeason, getMyCampHistory, type CampSubmission } from "@/lib/camp";
import { normalizeReviewStatus, reviewStatusClassName, reviewStatusLabel } from "@/lib/review-status";
import { supabase } from "@/lib/supabaseClient";

type ListingSubmission = {
  id: string;
  category: string;
  title: string;
  status: string;
  created_at: string;
};

type SubmissionItem = {
  id: string;
  type: string;
  title: string;
  detail: string;
  status: string;
  points?: number | null;
  createdAt: string;
  href?: string;
};

function campSubmissionTitle(submission: CampSubmission) {
  const fields = submission.submitted_payload?.fields || {};
  const actions = Array.isArray(fields.actions) ? fields.actions.join(", ") : "";
  return actions || submission.challenge_key.replaceAll("_", " ") || "Camp GPE action";
}

function campSubmissionStatus(submission: CampSubmission) {
  const statuses = (submission.gpe_camp_submission_actions || []).map((action) =>
    normalizeReviewStatus(action.review_status),
  );
  if (statuses.includes("needs_information")) return "needs_information";
  if (statuses.includes("pending")) return "pending";
  if (statuses.includes("rejected")) return "rejected";
  if (statuses.includes("duplicate")) return "duplicate";
  if (statuses.includes("approved")) return "approved";
  return submission.review_status;
}

export default function MySubmissions() {
  const [campSubmissions, setCampSubmissions] = useState<CampSubmission[]>([]);
  const [listingSubmissions, setListingSubmissions] = useState<ListingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const activeSeason = await getActiveCampSeason();
      if (activeSeason) {
        const history = await getMyCampHistory(activeSeason.id);
        setCampSubmissions(history.submissions);
      } else {
        setCampSubmissions([]);
      }

      if (user) {
        const { data, error: listingsError } = await supabase
          .from("listings")
          .select("id,category,title,status,created_at")
          .eq("submitted_by", user.id)
          .order("created_at", { ascending: false });
        if (listingsError) throw listingsError;
        setListingSubmissions((data || []) as ListingSubmission[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your submissions could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSubmissions();
  }, []);

  const submissions = useMemo<SubmissionItem[]>(() => {
    const campItems = campSubmissions.map((submission) => {
      const approvedPoints = (submission.gpe_camp_submission_actions || [])
        .filter((action) => normalizeReviewStatus(action.review_status) === "approved")
        .reduce((sum, action) => sum + (action.approved_points || 0), 0);
      return {
        id: submission.id,
        type: "Camp",
        title: campSubmissionTitle(submission),
        detail: submission.contact_email,
        status: campSubmissionStatus(submission),
        points: approvedPoints || null,
        createdAt: submission.created_at,
        href: "/leaderboard",
      };
    });

    const listingItems = listingSubmissions.map((listing) => ({
      id: listing.id,
      type: listing.category,
      title: listing.title,
      detail: "Community listing submission",
      status: listing.status,
      createdAt: listing.created_at,
      href: `/listing/${listing.id}`,
    }));

    return [...campItems, ...listingItems].sort(
      (first, second) => new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
    );
  }, [campSubmissions, listingSubmissions]);

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <div className="mx-auto max-w-5xl space-y-8">
          <SectionHeader
            eyebrow={<Sticker accent="cyan"><FileText className="mr-2 h-4 w-4" /> Status</Sticker>}
            title="My Submissions"
            description="Track actions, challenge claims, and community submissions while Team GPE reviews them."
            action={<Button variant="outline" onClick={loadSubmissions}>Refresh</Button>}
          />

          {error && (
            <div className="rounded-[1.5rem] border-[3px] border-red-500 bg-red-100 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Submission History</CardTitle>
              <CardDescription>Approved actions show points after review. Needs more information means Team GPE may follow up.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="rounded-[1.5rem] border-[3px] border-black bg-gpe-yellow p-5 text-sm font-bold">
                  You do not have any submissions yet.
                </div>
              ) : (
                submissions.map((submission) => (
                  <div key={`${submission.type}-${submission.id}`} className="rounded-[1.5rem] border-[3px] border-black bg-white p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{submission.type}</Badge>
                          <Badge variant="outline" className={reviewStatusClassName(submission.status)}>
                            {reviewStatusLabel(submission.status)}
                          </Badge>
                          {submission.points ? (
                            <Badge className="bg-green-100 text-green-800">
                              <Trophy className="mr-1 h-3 w-3" />
                              +{submission.points} pts
                            </Badge>
                          ) : null}
                        </div>
                        <h2 className="mt-3 break-words text-lg font-black">{submission.title}</h2>
                        <p className="mt-1 break-words text-sm font-bold text-black/60">{submission.detail}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 text-sm font-bold text-black/60 md:items-end">
                        <span className="inline-flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" />
                          {new Date(submission.createdAt).toLocaleDateString()}
                        </span>
                        {submission.href ? (
                          <Link to={submission.href}>
                            <Button size="sm" variant="outline">Open</Button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

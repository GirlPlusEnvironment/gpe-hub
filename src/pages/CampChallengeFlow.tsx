import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, Sticker, Tape } from "@/components/camp/CampDesign";
import { type CampChallenge, type CampSeason, getActiveCampSeason, getHubCampChallengeBySlug } from "@/lib/camp";
import { describeResolvedChallengeFlow, memberChallengeAction, resolveChallengeOpenFlow } from "@/lib/challenge-definition";

export default function CampChallengeFlow() {
  const { challengeSlug } = useParams();
  const [season, setSeason] = useState<CampSeason | null>(null);
  const [challenge, setChallenge] = useState<CampChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await getActiveCampSeason();
      setSeason(active);
      if (!active || !challengeSlug) {
        setChallenge(null);
        return;
      }
      setChallenge(await getHubCampChallengeBySlug(active.id, challengeSlug));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Challenge action could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [challengeSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main">
          <LoadingCampCard label="Loading challenge action" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !season || !challenge) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main">
          <EmptyState
            illustration="clipboard"
            title="Action Not Available"
            description={error || "This challenge action is not available right now."}
            action={<Link to="/camp-gpe/challenges"><CampButton variant="outline">Back to Challenges</CampButton></Link>}
          />
        </main>
        <Footer />
      </div>
    );
  }

  const flow = resolveChallengeOpenFlow(challenge);
  const memberAction = memberChallengeAction(challenge);
  const flowDebug = describeResolvedChallengeFlow(challenge);

  if (import.meta.env.DEV) {
    console.info("Camp challenge flow resolved", flowDebug);
  }

  if (!flow.external && flow.kind === "submission_form") {
    return <Navigate to={flow.href} replace />;
  }

  if (!flow.external && (flow.kind === "completion_page" || flow.kind === "completion_only")) {
    return <Navigate to={flow.href} replace />;
  }

  if (flow.invalid) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main">
          <EmptyState
            illustration="clipboard"
            title="Action Not Configured"
            description={flow.invalidReason || "Team GPE needs to finish configuring this challenge destination."}
            action={<Link to={`/camp-gpe/challenges/${challenge.slug}`}><CampButton variant="outline">Challenge Details</CampButton></Link>}
          />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main space-y-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <SectionHeader
            eyebrow={<Sticker accent="cyan">Challenge Action</Sticker>}
            title={challenge.title}
            description={challenge.short_description || "Follow the next step configured for this Camp GPE challenge."}
            action={<Link to={`/camp-gpe/challenges/${challenge.slug}`}><CampButton variant="outline">Challenge Details</CampButton></Link>}
          />

          <Card className="border-[4px] border-black">
            <CardHeader>
              <Tape>{flow.kind.replaceAll("_", " ")}</Tape>
              <CardTitle className="font-header text-3xl uppercase">{memberAction.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <a href={flow.href} target="_blank" rel="noopener noreferrer">
                <CampButton className="w-full justify-center" variant="secondary">
                  {memberAction.label} <ExternalLink className="ml-2 h-4 w-4" />
                </CampButton>
              </a>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Send, Trophy } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, Sticker, Tape } from "@/components/camp/CampDesign";
import { useAuth } from "@/hooks/useAuth";
import { type CampChallenge, type CampPointsLedgerRow, type CampSeason, type CampSubmission, type CampSeasonMember, getActiveCampSeason, getHubCampChallengeBySlug, getMyCampHistory, getMyCampStatus } from "@/lib/camp";
import { challengeDefinition, submissionFieldsForChallenge, type ChallengeSubmissionField } from "@/lib/challenge-definition";
import { supabase } from "@/lib/supabaseClient";

function isClosed(challenge: CampChallenge) {
  const now = Date.now();
  const start = challenge.starts_at ? new Date(challenge.starts_at).getTime() : null;
  const end = challenge.ends_at ? new Date(challenge.ends_at).getTime() : null;
  return Boolean((start && now < start) || (end && now > end));
}

function fieldInitialValue(field: ChallengeSubmissionField) {
  return field.type === "checkbox" ? [] : "";
}

function fieldInputType(field: ChallengeSubmissionField) {
  if (field.type === "url" || field.type === "file" || field.type === "image" || field.type === "video_url") return "url";
  return "text";
}

export default function CampChallengeSubmit() {
  const { challengeSlug } = useParams();
  const { profile, user } = useAuth();
  const [season, setSeason] = useState<CampSeason | null>(null);
  const [challenge, setChallenge] = useState<CampChallenge | null>(null);
  const [campStatus, setCampStatus] = useState<CampSeasonMember | null>(null);
  const [submissions, setSubmissions] = useState<CampSubmission[]>([]);
  const [ledger, setLedger] = useState<CampPointsLedgerRow[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ submissionId: string; message: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const active = await getActiveCampSeason();
      setSeason(active);
      if (!active || !challengeSlug) return;
      const [challengeRow, history, status] = await Promise.all([
        getHubCampChallengeBySlug(active.id, challengeSlug),
        getMyCampHistory(active.id),
        getMyCampStatus(active.id),
      ]);
      setChallenge(challengeRow);
      setCampStatus(status);
      setSubmissions(history.submissions);
      setLedger(history.ledger);
      if (challengeRow) {
        setValues(Object.fromEntries(submissionFieldsForChallenge(challengeRow).map((field) => [field.id, fieldInitialValue(field)])));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission form could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [challengeSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = useMemo(() => challenge ? submissionFieldsForChallenge(challenge) : [], [challenge]);
  const definition = challengeDefinition(challenge);
  const completed = challenge ? ledger.some((row) => row.challenge_id === challenge.id && !row.reversed_at && row.approval_status !== "reversed" && row.entry_type === "challenge_award") : false;
  const membershipInactive = !campStatus || !["active", "registered"].includes(String(campStatus.status));
  const openSubmission = challenge
    ? submissions.find((submission) =>
        (submission.gpe_camp_submission_actions || []).some((action) =>
          action.challenge_id === challenge.id &&
          ["pending", "needs_information"].includes(String(action.review_status)),
        ),
      )
    : null;
  const submissionsEnabled = definition.submission?.enabled !== false;

  function updateValue(field: ChallengeSubmissionField, value: unknown) {
    setValues((current) => ({ ...current, [field.id]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    setError(null);
    setConfirmation(null);

    for (const field of fields) {
      const value = values[field.id];
      const empty = field.type === "checkbox" ? !Array.isArray(value) || value.length === 0 : !String(value || "").trim();
      if (field.required && empty) {
        setError(`${field.label} is required.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("camp-gpe-challenge-submit", {
        body: {
          idempotencyKey: `challenge:${challenge.id}:${crypto.randomUUID()}`,
          challengeSlug: challenge.slug,
          submissionData: values,
          fields: {
            firstName: profile?.first_name || "",
            lastName: profile?.last_name || "",
            email: profile?.email || user?.email || "",
          },
        },
      });
      if (invokeError) throw invokeError;
      if (!data?.ok && !data?.duplicate) throw new Error(data?.message || "Challenge submission failed.");
      setConfirmation({
        submissionId: String(data.reviewSubmissionId || data.submissionId || ""),
        message: data.message || "Your submission has been received and will be reviewed by Team GPE.",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Challenge submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main"><LoadingCampCard label="Loading submission form" /></main>
        <Footer />
      </div>
    );
  }

  if (!season || !challenge) {
    return (
      <div className="gpe-page">
        <Header />
        <main className="gpe-page-main">
          <EmptyState illustration="clipboard" title="Submission Not Available" description={error || "This challenge is not accepting submissions right now."} action={<Link to="/camp-gpe/challenges"><CampButton variant="outline">Back to Challenges</CampButton></Link>} />
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
            eyebrow={<Sticker accent="yellow">Submission</Sticker>}
            title={definition.submission?.title || "Submit Your Challenge"}
            description={definition.submission?.instructions || challenge.short_description || "Share your proof and Team GPE will review it."}
            action={<Link to={`/camp-gpe/challenges/${challenge.slug}`}><CampButton variant="outline">Challenge Details</CampButton></Link>}
          />

          {confirmation ? (
            <Card className="border-[4px] border-black bg-cyan-50">
              <CardHeader>
                <Tape>Submission received</Tape>
                <CardTitle className="font-header text-3xl uppercase">Under Review</CardTitle>
                <CardDescription>{confirmation.message}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 font-bold">
                <div>Submitted {new Date().toLocaleDateString()}</div>
                <div>Team GPE will review your submission. Points are awarded after approval.</div>
                <Link to={`/camp-gpe/challenges/${challenge.slug}`}>
                  <CampButton variant="secondary">
                    <Trophy className="mr-2 h-4 w-4" />
                    View Challenge Status
                  </CampButton>
                </Link>
              </CardContent>
            </Card>
          ) : completed ? (
            <Card className="border-[4px] border-black bg-cyan-50">
              <CardHeader>
                <Tape>Already submitted</Tape>
                <CardTitle className="font-header text-3xl uppercase">Challenge Complete</CardTitle>
                <CardDescription>This challenge already has an approved point award on your Camp GPE ledger.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 font-bold">
                <div>Duplicate submissions are blocked so points are not awarded twice.</div>
                <Link to={`/camp-gpe/challenges/${challenge.slug}`}>
                  <CampButton variant="secondary">
                    <Trophy className="mr-2 h-4 w-4" />
                    View Challenge Status
                  </CampButton>
                </Link>
              </CardContent>
            </Card>
          ) : openSubmission ? (
            <Card className="border-[4px] border-black bg-cyan-50">
              <CardHeader>
                <Tape>Submission pending</Tape>
                <CardTitle className="font-header text-3xl uppercase">Under Review</CardTitle>
                <CardDescription>You already have an open submission for this challenge.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 font-bold">
                <div>Submitted {new Date(openSubmission.created_at).toLocaleDateString()}</div>
                <div>Team GPE needs to finish reviewing this before another submission can be opened.</div>
                <Link to="/my-submissions">
                  <CampButton variant="secondary">
                    <Trophy className="mr-2 h-4 w-4" />
                    View Submission Status
                  </CampButton>
                </Link>
              </CardContent>
            </Card>
          ) : membershipInactive ? (
            <EmptyState
              illustration="clipboard"
              title="Membership Required"
              description="An active Camp GPE member record is required before this submission form can accept your work."
              action={<Link to={`/camp-gpe/challenges/${challenge.slug}`}><CampButton variant="outline">Back to Challenge</CampButton></Link>}
            />
          ) : !submissionsEnabled || isClosed(challenge) ? (
            <EmptyState
              illustration="clipboard"
              title={submissionsEnabled ? "Submissions Closed" : "Submission Form Disabled"}
              description={submissionsEnabled ? "This challenge is outside its configured submission window." : "Team GPE has not enabled the dynamic submission form for this challenge."}
              action={<Link to={`/camp-gpe/challenges/${challenge.slug}`}><CampButton variant="outline">Back to Challenge</CampButton></Link>}
            />
          ) : (
            <Card className="border-[4px] border-black">
              <CardHeader>
                <Tape>{challenge.title}</Tape>
                <CardTitle className="font-header text-3xl uppercase">Challenge Form</CardTitle>
              </CardHeader>
              <CardContent>
                {error ? <div className="mb-4 rounded-xl border-2 border-red-500 bg-red-100 p-3 text-sm font-bold text-red-700">{error}</div> : null}
                <form onSubmit={submit} className="space-y-5">
                  {fields.map((field) => (
                    <div key={field.id}>
                      <Label htmlFor={`submission-${field.id}`}>{field.label}{field.required ? " *" : ""}</Label>
                      {field.helper_text ? <p className="mb-2 text-xs font-bold text-black/60">{field.helper_text}</p> : null}
                      {field.type === "textarea" ? (
                        <Textarea id={`submission-${field.id}`} value={String(values[field.id] || "")} onChange={(event) => updateValue(field, event.target.value)} />
                      ) : field.type === "select" ? (
                        <select id={`submission-${field.id}`} value={String(values[field.id] || "")} onChange={(event) => updateValue(field, event.target.value)} className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                          <option value="">Select one</option>
                          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                      ) : field.type === "checkbox" ? (
                        <div className="mt-2 space-y-2">
                          {(field.options?.length ? field.options : ["yes"]).map((option) => {
                            const selected = Array.isArray(values[field.id]) && values[field.id].includes(option);
                            return (
                              <label key={option} className="flex items-center gap-3 rounded-xl border-2 border-black bg-white p-3 text-sm font-black">
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={(event) => {
                                    const current = Array.isArray(values[field.id]) ? values[field.id] as string[] : [];
                                    updateValue(field, event.target.checked ? [...current, option] : current.filter((item) => item !== option));
                                  }}
                                />
                                {option}
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <Input id={`submission-${field.id}`} type={fieldInputType(field)} value={String(values[field.id] || "")} onChange={(event) => updateValue(field, event.target.value)} />
                      )}
                    </div>
                  ))}
                  <Button disabled={submitting} type="submit">
                    <Send className="mr-2 h-4 w-4" />
                    {submitting ? "Submitting" : "Submit Challenge"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

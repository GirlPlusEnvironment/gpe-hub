import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, MessageSquare, Tent, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createHubCabin, requestJoinCabin } from "@/lib/mentorship";

type CabinMode = "create" | "join";

type CabinFormState = {
  mode: CabinMode;
  name: string;
  description: string;
  seasonId: string;
  theme: string;
  imageUrl: string;
  visibility: string;
  maxMembers: string;
  locationMode: string;
  focusArea: string;
  inviteOnly: boolean;
  approvalRequired: boolean;
  communityAgreement: string;
  cabinId: string;
  introduction: string;
  joinReason: string;
  rulesConsent: boolean;
};

const initialForm: CabinFormState = {
  mode: "create",
  name: "",
  description: "",
  seasonId: "",
  theme: "",
  imageUrl: "",
  visibility: "members",
  maxMembers: "12",
  locationMode: "either",
  focusArea: "",
  inviteOnly: false,
  approvalRequired: true,
  communityAgreement: "",
  cabinId: "",
  introduction: "",
  joinReason: "",
  rulesConsent: false,
};

export default function CabinSubmissionForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState<CabinFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string; conversationId?: string | null } | null>(null);

  const updateField = (field: keyof CabinFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      if (form.mode === "create") {
        if (!form.name.trim() || !form.description.trim()) {
          throw new Error("Cabin name and description are required.");
        }
        const created = await createHubCabin({
          name: form.name,
          description: form.description,
          seasonId: form.seasonId || null,
          theme: form.theme,
          imageUrl: form.imageUrl,
          visibility: form.visibility,
          maxMembers: form.maxMembers,
          locationMode: form.locationMode,
          focusArea: form.focusArea,
          inviteOnly: form.inviteOnly,
          approvalRequired: form.approvalRequired,
          communityAgreement: form.communityAgreement,
        });
        setResult({ id: created.cabinId || "", conversationId: created.conversationId });
        toast({
          title: "Cabin created",
          description: "The cabin and group chat were created together.",
        });
        return;
      }

      if (!form.cabinId.trim() || !form.rulesConsent) {
        throw new Error("Choose a cabin and accept the cabin rules before requesting to join.");
      }

      const request = await requestJoinCabin({
        cabinId: form.cabinId,
        introduction: form.introduction,
        joinReason: form.joinReason,
        rulesConsent: form.rulesConsent,
      });
      setResult({ id: request?.id || form.cabinId });
      toast({
        title: "Cabin request submitted",
        description: "The cabin lead or Team GPE can review it.",
      });
    } catch (error) {
      toast({
        title: "Cabin workflow failed",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tent className="h-5 w-5" />
            Camp Cabin
          </CardTitle>
          <CardDescription>
            Cabins use the same Camp membership and Messages system as the rest of the Hub.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={form.mode} onValueChange={(value) => updateField("mode", value as CabinMode)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create a Cabin</TabsTrigger>
              <TabsTrigger value="join">Request to Join</TabsTrigger>
            </TabsList>
            <TabsContent value="create" className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Cabin name">
                <Input value={form.name} onChange={(event) => updateField("name", event.target.value)} required />
              </Field>
              <Field label="Season ID">
                <Input value={form.seasonId} onChange={(event) => updateField("seasonId", event.target.value)} placeholder="Leave blank for active season" />
              </Field>
              <Field label="Theme">
                <Input value={form.theme} onChange={(event) => updateField("theme", event.target.value)} />
              </Field>
              <Field label="Icon/image link">
                <Input value={form.imageUrl} onChange={(event) => updateField("imageUrl", event.target.value)} />
              </Field>
              <Field label="Visibility">
                <select className="gpe-input" value={form.visibility} onChange={(event) => updateField("visibility", event.target.value)}>
                  <option value="members">Hub members</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </Field>
              <Field label="Maximum members">
                <Input type="number" min="1" value={form.maxMembers} onChange={(event) => updateField("maxMembers", event.target.value)} />
              </Field>
              <Field label="Location or remote">
                <select className="gpe-input" value={form.locationMode} onChange={(event) => updateField("locationMode", event.target.value)}>
                  <option value="either">Either</option>
                  <option value="remote">Remote</option>
                  <option value="local">Local</option>
                </select>
              </Field>
              <Field label="Focus area">
                <Input value={form.focusArea} onChange={(event) => updateField("focusArea", event.target.value)} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Cabin description">
                  <Textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} required />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="Rules/community agreement">
                  <Textarea value={form.communityAgreement} onChange={(event) => updateField("communityAgreement", event.target.value)} />
                </Field>
              </div>
              <label className="flex items-center gap-3 rounded-md border-[3px] border-black bg-white p-4 text-sm font-bold">
                <input type="checkbox" checked={form.inviteOnly} onChange={(event) => updateField("inviteOnly", event.target.checked)} />
                Invite-only cabin
              </label>
              <label className="flex items-center gap-3 rounded-md border-[3px] border-black bg-white p-4 text-sm font-bold">
                <input type="checkbox" checked={form.approvalRequired} onChange={(event) => updateField("approvalRequired", event.target.checked)} />
                Member approval required
              </label>
            </TabsContent>
            <TabsContent value="join" className="mt-6 space-y-4">
              <Field label="Cabin ID">
                <Input value={form.cabinId} onChange={(event) => updateField("cabinId", event.target.value)} />
              </Field>
              <Field label="Short introduction">
                <Textarea value={form.introduction} onChange={(event) => updateField("introduction", event.target.value)} />
              </Field>
              <Field label="Why do you want to join?">
                <Textarea value={form.joinReason} onChange={(event) => updateField("joinReason", event.target.value)} />
              </Field>
              <label className="flex items-start gap-3 rounded-md border-[3px] border-black bg-white p-4 text-sm font-bold">
                <input type="checkbox" checked={form.rulesConsent} onChange={(event) => updateField("rulesConsent", event.target.checked)} className="mt-1" />
                <span>I agree to follow the cabin rules and community agreement.</span>
              </label>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {result ? (
        <div className="rounded-md border-[3px] border-black bg-gpe-yellow p-4 text-sm font-bold">
          <CheckCircle2 className="mr-2 inline h-4 w-4" />
          {form.mode === "create" ? "Cabin created" : "Request created"}: {result.id}
          {result.conversationId ? (
            <Button type="button" className="ml-3" size="sm" onClick={() => navigate(`/messages?conversation=${result.conversationId}`)}>
              <MessageSquare className="h-4 w-4" />
              Open Cabin Chat
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {form.mode === "create" ? "Create Cabin" : "Request to Join"}
        </Button>
        <Button type="button" variant="outline" onClick={() => navigate("/leaderboard?tab=cabins")}>
          <Tent className="h-4 w-4" />
          View Cabins
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div id={id}>{children}</div>
    </div>
  );
}

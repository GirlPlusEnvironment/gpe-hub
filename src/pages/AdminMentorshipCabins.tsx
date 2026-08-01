import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MessageSquare, ShieldCheck, Tent, UsersRound, XCircle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampButton, EmptyState, LoadingCampCard, SectionHeader, Sticker } from "@/components/camp/CampDesign";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAdminCabinMembers,
  fetchAdminMentorshipListings,
  mentorshipBadge,
  respondCabinMembership,
  updateMyMentorshipListingStatus,
  type MentorshipListingStatus,
} from "@/lib/mentorship";

export default function AdminMentorshipCabins() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const { data: listings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ["admin-mentorship-listings"],
    queryFn: fetchAdminMentorshipListings,
  });

  const { data: cabinMembers = [], isLoading: cabinMembersLoading } = useQuery({
    queryKey: ["admin-cabin-members"],
    queryFn: fetchAdminCabinMembers,
  });

  const setListingStatus = async (listingId: string, status: MentorshipListingStatus) => {
    setBusyId(listingId);
    setLastResult(null);
    try {
      const listing = await updateMyMentorshipListingStatus(listingId, status);
      setLastResult(`Listing ${listing.id} -> ${listing.status}`);
      await queryClient.invalidateQueries({ queryKey: ["admin-mentorship-listings"] });
    } catch (error) {
      toast({
        title: "Mentorship review failed",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const reviewCabinMember = async (memberId: string, decision: "approved" | "declined") => {
    setBusyId(memberId);
    setLastResult(null);
    try {
      const result = await respondCabinMembership({ cabinMemberId: memberId, decision });
      setLastResult(
        `Cabin member ${result.cabinMemberId || memberId} -> ${result.status}; conversation ${result.conversationId || "none"}`,
      );
      await queryClient.invalidateQueries({ queryKey: ["admin-cabin-members"] });
    } catch (error) {
      toast({
        title: "Cabin review failed",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <SectionHeader
          className="mb-8"
          eyebrow={<Sticker accent="pink"><ShieldCheck className="mr-2 h-4 w-4" /> Team GPE</Sticker>}
          title="Mentorship & Cabins"
          description="Review mentorship listings, inspect matches, and approve cabin membership requests."
        />

        {lastResult ? (
          <div className="mb-6 rounded-md border-[3px] border-black bg-gpe-cyan p-4 text-sm font-bold">
            {lastResult}
          </div>
        ) : null}

        <Tabs defaultValue="mentorship">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="mentorship"><UsersRound className="h-4 w-4" /> Mentorship</TabsTrigger>
            <TabsTrigger value="cabins"><Tent className="h-4 w-4" /> Cabins</TabsTrigger>
          </TabsList>
          <TabsContent value="mentorship" className="mt-6">
            {listingsLoading ? (
              <LoadingCampCard label="Loading mentorship listings" />
            ) : listings.length === 0 ? (
              <EmptyState illustration="notebook" title="No Listings" description="Mentorship listings will appear here after members submit them." />
            ) : (
              <div className="grid gap-4">
                {listings.map((listing) => (
                  <Card key={listing.id}>
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                        <span>{listing.headline}</span>
                        <span className="text-sm font-bold uppercase">{listing.status}</span>
                      </CardTitle>
                      <CardDescription>
                        {mentorshipBadge(listing)} by {listing.display_name} | {listing.created_at}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm font-bold text-black/70">{listing.intro || listing.support_needed || listing.mentor_areas}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => setListingStatus(listing.id, "published")} disabled={busyId === listing.id}>
                          {busyId === listing.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Publish
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setListingStatus(listing.id, "rejected")} disabled={busyId === listing.id}>
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setListingStatus(listing.id, "closed")} disabled={busyId === listing.id}>
                          Close
                        </Button>
                        <CampButton variant="outline" size="sm" onClick={() => navigate(`/mentorship/${listing.id}`)}>
                          View Details
                        </CampButton>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="cabins" className="mt-6">
            {cabinMembersLoading ? (
              <LoadingCampCard label="Loading cabin requests" />
            ) : cabinMembers.length === 0 ? (
              <EmptyState illustration="tent" title="No Cabin Members" description="Cabin membership requests and active members will appear here." />
            ) : (
              <div className="grid gap-4">
                {cabinMembers.map((member) => (
                  <Card key={member.id}>
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center justify-between gap-3">
                        <span>{member.gpe_cabins?.name || "Cabin"}</span>
                        <span className="text-sm font-bold uppercase">{member.status}</span>
                      </CardTitle>
                      <CardDescription>
                        {member.profiles?.full_name || member.profiles?.username || member.profile_id} | {member.role}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm font-bold text-black/70">{member.join_reason || member.introduction || "No request note."}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => reviewCabinMember(member.id, "approved")} disabled={busyId === member.id}>
                          {busyId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Approve
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => reviewCabinMember(member.id, "declined")} disabled={busyId === member.id}>
                          <XCircle className="h-4 w-4" />
                          Decline
                        </Button>
                        {member.gpe_cabins?.conversation_id ? (
                          <CampButton variant="cyan" size="sm" onClick={() => navigate(`/messages?conversation=${member.gpe_cabins?.conversation_id}`)}>
                            <MessageSquare className="h-4 w-4" />
                            Open Chat
                          </CampButton>
                        ) : null}
                        <CampButton variant="outline" size="sm" onClick={() => navigate(`/camp-gpe/cabins/${member.cabin_id}`)}>
                          Open Cabin
                        </CampButton>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}

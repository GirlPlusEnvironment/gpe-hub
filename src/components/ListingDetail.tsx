import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CommentsSection } from "@/components/CommentsSection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfileCard } from "@/components/UserProfileCard";
import { useAuth } from "@/contexts/AuthContext";
import { useMessages } from "@/contexts/MessagesContext";
import { 
  ArrowLeft, 
  Heart, 
  MapPin, 
  Clock, 
  DollarSign, 
  Users, 
  Calendar,
  ExternalLink,
  Mail,
  Download,
  Tag,
  User,
  Building,
  Briefcase,
  Globe,
  UserCircle,
  BellRing,
  MessageSquare,
  Loader2
} from "lucide-react";
import { Listing, JobListing, EventListing, FundraiserListing, ResourceListing } from "@/types/listings";
import { ShareDialog } from "@/components/ShareDialog";

interface ListingDetailProps {
  listing: Listing;
  onBack: () => void;
  isFavorited: boolean;
  isPending?: boolean;
  onToggleFavorite: (id: string) => void;
}

const ListingDetail = ({ listing, onBack, isFavorited, isPending = false, onToggleFavorite }: ListingDetailProps) => {
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isStartingChat, setIsStartingChat] = useState(false);
  const { user } = useAuth();
  const { createDirectConversation } = useMessages();
  const navigate = useNavigate();

  const isOwnListing = user?.id === listing.submitted_by?.id;

  const handleMessagePoster = async () => {
    if (!user || !listing.submitted_by?.id || isOwnListing) return;
    
    setIsStartingChat(true);
    try {
      const conversation = await createDirectConversation(user.id, listing.submitted_by.id);
      if (conversation) {
        navigate("/messages");
      }
    } catch (err) {
      console.error("Failed to start conversation", err);
    } finally {
      setIsStartingChat(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'jobs': return <Briefcase className="h-5 w-5" />;
      case 'events': return <Calendar className="h-5 w-5" />;
      case 'fundraisers': return <DollarSign className="h-5 w-5" />;
      case 'resources': return <Download className="h-5 w-5" />;
      default: return null;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'jobs': return 'bg-blue-100 text-blue-800';
      case 'events': return 'bg-green-100 text-green-800';
      case 'fundraisers': return 'bg-purple-100 text-purple-800';
      case 'resources': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderJobDetails = (job: JobListing) => (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{job.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{job.company || 'Company not specified'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{job.jobType}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{job.experienceLevel}</span>
        </div>
      </div>

      {/* Salary */}
      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-semibold text-lg text-primary mb-2">Compensation</h4>
        <p className="text-2xl font-bold">{job.salary}</p>
      </div>

      {/* Requirements */}
      {job.requirements && job.requirements.length > 0 && (
        <div>
          <h4 className="font-semibold text-lg mb-3">Requirements</h4>
          <ul className="list-disc list-inside space-y-1">
            {job.requirements.map((req, index) => (
              <li key={index} className="text-muted-foreground">{req}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Benefits */}
      {job.benefits && job.benefits.length > 0 && (
        <div>
          <h4 className="font-semibold text-lg mb-3">Benefits</h4>
          <ul className="list-disc list-inside space-y-1">
            {job.benefits.map((benefit, index) => (
              <li key={index} className="text-muted-foreground">{benefit}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Application Info */}
      <div className="bg-primary/5 p-4 rounded-lg">
        <h4 className="font-semibold text-lg mb-3">Application Details</h4>
        {job.applicationDeadline && (
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Deadline:</strong> {job.applicationDeadline}
          </p>
        )}
        {job.contactEmail && (
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Contact:</strong> {job.contactEmail}
          </p>
        )}
        {job.applicationUrl && (
          <Button asChild className="w-full">
            <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Apply Now
            </a>
          </Button>
        )}
      </div>
    </div>
  );

  const renderEventDetails = (event: EventListing) => (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{event.date}</span>
        </div>
        {event.time && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{event.time}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{event.location}</span>
        </div>
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{event.cost}</span>
        </div>
      </div>

      {/* Organizer */}
      {event.organizer && (
        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold text-lg mb-2">Organized by</h4>
          <p className="text-muted-foreground">{event.organizer}</p>
        </div>
      )}

      {/* Attendees */}
      {event.maxAttendees && (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Max {event.maxAttendees} attendees</span>
        </div>
      )}

      {/* Agenda */}
      {event.agenda && event.agenda.length > 0 && (
        <div>
          <h4 className="font-semibold text-lg mb-3">Event Agenda</h4>
          <ul className="list-disc list-inside space-y-1">
            {event.agenda.map((item, index) => (
              <li key={index} className="text-muted-foreground">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Registration */}
      <div className="bg-primary/5 p-4 rounded-lg">
        <h4 className="font-semibold text-lg mb-3">Registration</h4>
        {event.contactEmail && (
          <p className="text-sm text-muted-foreground mb-2">
            <strong>Contact:</strong> {event.contactEmail}
          </p>
        )}
        {event.registrationUrl && (
          <Button asChild className="w-full">
            <a href={event.registrationUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Register Now
            </a>
          </Button>
        )}
      </div>
    </div>
  );

  const renderFundraiserDetails = (fundraiser: FundraiserListing) => {
    const progressPercentage = fundraiser.progressPercentage || 
      (parseFloat(fundraiser.currentAmount.replace(/[$,]/g, '')) / 
       parseFloat(fundraiser.goalAmount.replace(/[$,]/g, ''))) * 100;

    return (
      <div className="space-y-6">
        {/* Progress */}
        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold text-lg mb-3">Fundraising Progress</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Raised: {fundraiser.currentAmount}</span>
              <span>Goal: {fundraiser.goalAmount}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {progressPercentage.toFixed(1)}% of goal reached
            </p>
          </div>
        </div>

        {/* Organizer */}
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Organized by {fundraiser.organizer}</span>
        </div>

        {/* Deadline */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Deadline: {fundraiser.deadline}</span>
        </div>

        {/* Updates */}
        {fundraiser.updates && fundraiser.updates.length > 0 && (
          <div>
            <h4 className="font-semibold text-lg mb-3">Recent Updates</h4>
            <div className="space-y-2">
              {fundraiser.updates.map((update, index) => (
                <div key={index} className="bg-muted p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">{update}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Donation */}
        <div className="bg-primary/5 p-4 rounded-lg">
          <h4 className="font-semibold text-lg mb-3">Support This Cause</h4>
          {fundraiser.contactEmail && (
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Contact:</strong> {fundraiser.contactEmail}
            </p>
          )}
          {fundraiser.donationUrl && (
            <Button asChild className="w-full">
              <a href={fundraiser.donationUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Donate Now
              </a>
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderResourceDetails = (resource: ResourceListing) => (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{resource.resourceType}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{resource.author || 'Author not specified'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Topic: {resource.topic}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Level: {resource.difficultyLevel}</span>
        </div>
      </div>

      {/* Tags */}
      {resource.tags && resource.tags.length > 0 && (
        <div>
          <h4 className="font-semibold text-lg mb-3">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {resource.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* File Info */}
      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-semibold text-lg mb-3">Resource Information</h4>
        <div className="space-y-2">
          {resource.lastUpdated && (
            <p className="text-sm text-muted-foreground">
              <strong>Last Updated:</strong> {resource.lastUpdated}
            </p>
          )}
          {resource.fileSize && (
            <p className="text-sm text-muted-foreground">
              <strong>File Size:</strong> {resource.fileSize}
            </p>
          )}
        </div>
      </div>

      {/* Download */}
      {resource.downloadUrl && (
        <div className="bg-primary/5 p-4 rounded-lg">
          <h4 className="font-semibold text-lg mb-3">Access Resource</h4>
          <Button asChild className="w-full">
            <a href={resource.downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-2" />
              Download Resource
            </a>
          </Button>
        </div>
      )}
    </div>
  );

  const renderCategorySpecificDetails = () => {
    switch (listing.category) {
      case 'jobs':
        return renderJobDetails(listing as JobListing);
      case 'events':
        return renderEventDetails(listing as EventListing);
      case 'fundraisers':
        return renderFundraiserDetails(listing as FundraiserListing);
      case 'resources':
        return renderResourceDetails(listing as ResourceListing);
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Explore
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getCategoryIcon(listing.category)}
                    <Badge className={getCategoryColor(listing.category)}>
                      {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                    </Badge>
                  </div>
                  <h1 className="text-3xl font-bold text-primary mb-2">
                    {listing.title}
                  </h1>
                </div>
                <button
                  onClick={() => onToggleFavorite(listing.id)}
                  disabled={isPending}
                  className="p-2 rounded-full hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                >
                  <Heart
                    className={`h-6 w-6 ${
                      isFavorited ? "text-red-500 fill-red-500" : "text-gray-400 hover:text-red-500"
                    }`}
                  />
                </button>
              </div>

              {/* Image */}
              <div className="relative">
                <img
                  src={listing.image}
                  alt={listing.title}
                  className="w-full h-64 object-cover rounded-lg"
                />
              </div>
            </div>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground leading-relaxed">
                  {showFullDescription 
                    ? listing.description 
                    : `${listing.description.substring(0, 200)}${listing.description.length > 200 ? '...' : ''}`
                  }
                </p>
                {listing.description.length > 200 && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="mt-2 p-0 h-auto"
                  >
                    {showFullDescription ? 'Show Less' : 'Read More'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Category-specific details */}
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                {renderCategorySpecificDetails()}
              </CardContent>
            </Card>
            <CommentsSection listingId={listing.id} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => onToggleFavorite(listing.id)}
                  disabled={isPending}
                >
                  <Heart className={`h-4 w-4 mr-2 ${isFavorited ? "text-red-500 fill-red-500" : ""}`} />
                  {isPending ? 'Updating...' : (isFavorited ? 'Remove from Favorites' : 'Add to Favorites')}
                </Button>
                <ShareDialog listingId={listing.id}>
                  <Button 
                    variant="outline" 
                    className="w-full"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </ShareDialog>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {listing.submitted_by ? (
                  <div className="space-y-3">
                    {/* Poster Info */}
                    <div 
                      className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors"
                      onClick={() => setIsProfileOpen(true)}
                    >
                      <Avatar className="h-12 w-12 ring-2 ring-transparent hover:ring-primary/20 transition-all">
                        <AvatarImage 
                          src={listing.submitted_by.avatar_url || ""} 
                          alt={listing.submitted_by.full_name || listing.submitted_by.username || "Poster"} 
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {(listing.submitted_by.full_name || listing.submitted_by.username || "A").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-lg hover:text-primary transition-colors">
                          {listing.submitted_by.full_name || listing.submitted_by.username || "Anonymous"}
                        </h4>
                        <p className="text-xs text-muted-foreground">Click to view profile</p>
                      </div>
                    </div>

                    {/* Message Poster Button */}
                    {user && !isOwnListing && (
                      <Button 
                        onClick={handleMessagePoster}
                        disabled={isStartingChat}
                        className="w-full gap-2"
                        variant="outline"
                      >
                        {isStartingChat ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageSquare className="h-4 w-4" />
                        )}
                        Message Poster
                      </Button>
                    )}

                    {/* Contact Details */}
                    <div className="space-y-2">
                      {listing.submitted_by.username && (
                        <div className="flex items-center gap-2 text-sm">
                          <UserCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">@{listing.submitted_by.username}</span>
                        </div>
                      )}
                      
                      {/* Category-specific contact info */}
                      {(() => {
                        switch (listing.category) {
                          case "jobs":
                            const job = listing as JobListing;
                            return (
                              <>
                                {job.contactEmail && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <a 
                                      href={`mailto:${job.contactEmail}`}
                                      className="text-primary hover:underline"
                                    >
                                      {job.contactEmail}
                                    </a>
                                  </div>
                                )}
                                {job.applicationUrl && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                    <a 
                                      href={job.applicationUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      Application Website
                                    </a>
                                  </div>
                                )}
                              </>
                            );
                          case "events":
                            const event = listing as EventListing;
                            return (
                              <>
                                {event.contactEmail && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <a 
                                      href={`mailto:${event.contactEmail}`}
                                      className="text-primary hover:underline"
                                    >
                                      {event.contactEmail}
                                    </a>
                                  </div>
                                )}
                                {event.registrationUrl && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                    <a 
                                      href={event.registrationUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      Registration Website
                                    </a>
                                  </div>
                                )}
                              </>
                            );
                          case "fundraisers":
                            const fundraiser = listing as FundraiserListing;
                            return (
                              <>
                                {fundraiser.contactEmail && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <a 
                                      href={`mailto:${fundraiser.contactEmail}`}
                                      className="text-primary hover:underline"
                                    >
                                      {fundraiser.contactEmail}
                                    </a>
                                  </div>
                                )}
                                {fundraiser.donationUrl && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                    <a 
                                      href={fundraiser.donationUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      Donation Website
                                    </a>
                                  </div>
                                )}
                              </>
                            );
                          case "resources":
                            const resource = listing as ResourceListing;
                            return (
                              <>
                                {resource.downloadUrl && (
                                  <div className="flex items-center gap-2 text-sm">
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                    <a 
                                      href={resource.downloadUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline"
                                    >
                                      Download Website
                                    </a>
                                  </div>
                                )}
                              </>
                            );
                          default:
                            return null;
                        }
                      })()}
                    </div>
                  </div>
                ) : (
                <p className="text-sm text-muted-foreground">
                  For more information about this listing, please contact the organizer or visit their website.
                </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* User Profile Card Modal */}
      {listing.submitted_by && (
        <UserProfileCard
          userId={listing.submitted_by.id}
          open={isProfileOpen}
          onOpenChange={setIsProfileOpen}
        />
      )}
    </div>
  );
};

export default ListingDetail;

import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Briefcase, Calendar, DollarSign, FileText } from "lucide-react";
import JobSubmissionForm from "./JobSubmissionForm";
import EventSubmissionForm from "./EventSubmissionForm";
import FundingSubmissionForm from "./FundingSubmissionForm";
import ResourceSubmissionForm from "./ResourceSubmissionForm";

const submissionTabs = [
  {
    id: "job",
    title: "Job",
    icon: <Briefcase className="h-5 w-5" />,
  },
  {
    id: "event",
    title: "Event",
    icon: <Calendar className="h-5 w-5" />,
  },
  {
    id: "funding",
    title: "Funding",
    icon: <DollarSign className="h-5 w-5" />,
  },
  {
    id: "resource",
    title: "Resource",
    icon: <FileText className="h-5 w-5" />,
  },
];

const Submit = () => {
  const [selectedTab, setSelectedTab] = useState("job");

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-4">Make a Submission</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Share opportunities and resources with the Girl + Environment community.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {submissionTabs.map((tab) => (
              <Button
                key={tab.id}
                variant={selectedTab === tab.id ? "default" : "outline"}
                onClick={() => setSelectedTab(tab.id)}
                className="flex items-center gap-2"
              >
                {tab.icon}
                {tab.title}
              </Button>
            ))}
          </div>

          {/* Tab Content */}
          <div>
            {selectedTab === "job" && <JobSubmissionForm />}
            {selectedTab === "event" && <EventSubmissionForm />}
            {selectedTab === "funding" && <FundingSubmissionForm />}
            {selectedTab === "resource" && <ResourceSubmissionForm />}
          </div>

          <div className="mt-8 text-center">
            <a href="/" className="text-primary hover:text-primary/80 underline">
              Back to Home
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Submit;

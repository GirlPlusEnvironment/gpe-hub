import { useState } from "react";
import { BookOpen, Briefcase, Calendar, DollarSign } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import JobSubmissionForm from "./JobSubmissionForm";
import EventSubmissionForm from "./EventSubmissionForm";
import FundingSubmissionForm from "./FundingSubmissionForm";
import ResourceSubmissionForm from "./ResourceSubmissionForm";

const submissionTabs = [
  { id: "job", title: "Job", icon: <Briefcase className="h-5 w-5" />, tone: "bg-gpe-jobs" },
  { id: "event", title: "Event", icon: <Calendar className="h-5 w-5" />, tone: "bg-gpe-events" },
  { id: "funding", title: "Funding", icon: <DollarSign className="h-5 w-5" />, tone: "bg-gpe-funding" },
  { id: "resource", title: "Resource", icon: <BookOpen className="h-5 w-5" />, tone: "bg-gpe-resources" },
];

const Submit = () => {
  const [selectedTab, setSelectedTab] = useState("job");

  return (
    <div className="gpe-page">
      <Header />
      <main className="gpe-page-main">
        <div className="mb-10">
          <h1 className="gpe-heading text-5xl md:text-7xl">Submit to Hub</h1>
          <p className="mt-4 max-w-3xl text-lg font-bold">
            Use the existing Supabase-backed forms to share jobs, events, funding,
            and resources with the community.
          </p>
        </div>

        <section className="mb-8 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black font-bold text-white">1</div>
            <span className="font-bold uppercase">Choose category</span>
          </div>
          <div className="h-1 w-12 rounded-full bg-black/20" />
          <div className="flex items-center gap-3 opacity-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-black bg-white font-bold">2</div>
            <span className="font-bold uppercase">Complete details</span>
          </div>
        </section>

        <section className="mb-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {submissionTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedTab(tab.id)}
              className={`gpe-card gpe-hover-lift p-8 text-center ${selectedTab === tab.id ? "ring-2 ring-black" : ""}`}
            >
              <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-black text-4xl ${tab.tone}`}>
                {tab.icon}
              </div>
              <h2 className="font-header text-3xl uppercase">{tab.title}</h2>
            </button>
          ))}
        </section>

        <section className="gpe-card p-6 md:p-10">
          {selectedTab === "job" && <JobSubmissionForm />}
          {selectedTab === "event" && <EventSubmissionForm />}
          {selectedTab === "funding" && <FundingSubmissionForm />}
          {selectedTab === "resource" && <ResourceSubmissionForm />}
        </section>

        <div className="mt-8">
          <Button variant="outline" onClick={() => window.history.back()}>
            Back
          </Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Submit;

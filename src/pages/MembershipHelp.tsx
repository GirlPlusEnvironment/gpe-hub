import { Link } from "react-router-dom";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import { CampButton, Sticker, Tape } from "@/components/camp/CampDesign";

const MembershipHelp = () => (
  <div className="gpe-page md:pl-0">
    <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
      <div className="gpe-card gpe-paper w-full p-8 md:p-10">
        <Tape className="mb-5">Membership help</Tape>
        <Link to="/login" className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Login
        </Link>
        <Sticker accent="yellow" className="mb-5">Account support</Sticker>
        <h1 className="gpe-heading text-4xl">Need Help Connecting Membership?</h1>
        <p className="mt-3 text-sm font-bold text-black/70">
          Use the same email for your GPE membership and Hub account whenever possible. If your records are under different emails, contact Team GPE so we can connect them.
        </p>
        <a href="mailto:support@gpecommunityhub.org" className="mt-8 block">
          <CampButton className="w-full" size="lg">
            <LifeBuoy className="mr-2 h-5 w-5" />
            Email Support
          </CampButton>
        </a>
      </div>
    </div>
  </div>
);

export default MembershipHelp;

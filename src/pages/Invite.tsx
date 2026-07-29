import { Link } from "react-router-dom";
import { ArrowLeft, MailPlus } from "lucide-react";
import { CampButton, Sticker, Tape } from "@/components/camp/CampDesign";

const Invite = () => (
  <div className="gpe-page md:pl-0">
    <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
      <div className="gpe-card gpe-paper w-full p-8 md:p-10">
        <Tape className="mb-5">Friend invite</Tape>
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Hub
        </Link>
        <Sticker accent="pink" className="mb-5">Coming next</Sticker>
        <h1 className="gpe-heading text-4xl">Invite a Friend</h1>
        <p className="mt-3 text-sm font-bold text-black/70">
          The signed-in friend invitation form will live here. For now, send eligible friends to the membership page.
        </p>
        <a href="https://www.girlplusenvironment.org/become-a-member" className="mt-8 block">
          <CampButton className="w-full" size="lg">
            <MailPlus className="mr-2 h-5 w-5" />
            Share Membership Page
          </CampButton>
        </a>
      </div>
    </div>
  </div>
);

export default Invite;

import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Sticker, Tape } from "@/components/camp/CampDesign";

const EmailPreferences = () => (
  <div className="gpe-page md:pl-0">
    <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-12">
      <div className="gpe-card gpe-paper w-full p-8 md:p-10">
        <Tape className="mb-5">Email preferences</Tape>
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Hub
        </Link>
        <Sticker accent="cyan" className="mb-5">Preferences</Sticker>
        <h1 className="gpe-heading text-4xl">Email Preferences</h1>
        <p className="mt-3 text-sm font-bold text-black/70">
          Preference controls are being connected to Hub lifecycle email categories. Until then, email support@gpecommunityhub.org and Team GPE will update your preferences.
        </p>
      </div>
    </div>
  </div>
);

export default EmailPreferences;

import { Mail } from "lucide-react";
import { getAuthEmailNotice, type AuthEmailMessageKind } from "@/lib/auth";

type AuthEmailNoticeProps = {
  kind: AuthEmailMessageKind;
};

export const AuthEmailNotice = ({ kind }: AuthEmailNoticeProps) => {
  return (
    <div className="mt-3 rounded-[1.25rem] border-[3px] border-black bg-white p-3 text-left text-xs font-bold leading-relaxed text-black/75">
      <div className="flex items-start gap-2">
        <Mail className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{getAuthEmailNotice(kind)}</p>
      </div>
    </div>
  );
};

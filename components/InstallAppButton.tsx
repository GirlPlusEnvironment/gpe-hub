import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useToast } from "@/hooks/use-toast";

type InstallAppButtonProps = {
  className?: string;
};

export const InstallAppButton = ({ className }: InstallAppButtonProps) => {
  const { canInstall, showIosFallback, promptInstall } = useInstallPrompt();
  const { toast } = useToast();

  if (!canInstall && !showIosFallback) {
    return null;
  }

  const label = canInstall ? "Install GPE Hub" : "Add GPE Hub to Home Screen";

  const handleClick = async () => {
    if (canInstall) {
      await promptInstall();
      return;
    }

    toast({
      title: "Add GPE Hub to your Home Screen",
      description:
        "On iPhone or iPad, tap Share in Safari, then choose Add to Home Screen.",
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      className={[
        "flex h-auto min-h-11 w-full max-w-full min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2",
        "text-[10px] leading-[1.15] text-center whitespace-normal break-words sm:gap-2 sm:px-3 sm:text-xs",
        "lg:whitespace-nowrap",
        className || "",
      ].join(" ")}
      onClick={handleClick}
      aria-label={label}
    >
      <Download className="h-4 w-4 shrink-0" />
      <span className="min-w-0 max-w-full flex-1 text-center leading-[1.15] normal-case">
        {label}
      </span>
    </Button>
  );
};

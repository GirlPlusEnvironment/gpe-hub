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

  const label = canInstall ? "Install GPE Hub" : "Add GPE Hub to your Home Screen";

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
      className={className}
      onClick={handleClick}
      aria-label={label}
    >
      <Download className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
};

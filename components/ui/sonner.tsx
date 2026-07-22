import { Toaster as SonnerToaster, type ToasterProps } from "sonner";

const Toaster = (props: ToasterProps) => (
  <SonnerToaster duration={4000} position="top-right" richColors {...props} />
);

export { Toaster };

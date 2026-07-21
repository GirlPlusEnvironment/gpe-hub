import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { canManageCamp } from "@/lib/roles";

export default function TeamRoute({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setAllowed(await canManageCamp());
      } catch {
        setAllowed(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null;
  if (!allowed) return <Navigate to="/" replace />;

  return <>{children}</>;
}

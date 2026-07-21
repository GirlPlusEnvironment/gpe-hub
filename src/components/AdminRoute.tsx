import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { isAdmin as checkIsAdmin } from "@/lib/roles";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setIsAdmin(await checkIsAdmin());
      } catch {
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return null; // or a spinner
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}

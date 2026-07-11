import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center">
    <p className="text-sm font-semibold uppercase tracking-wide text-primary">404</p>
    <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-5xl">Page not found</h1>
    <p className="mt-6 max-w-md text-base text-muted-foreground">
      The page you are looking for either never existed or was moved. Try heading back home or explore what the community is working on.
    </p>
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      <Button asChild>
        <Link to="/">Return home</Link>
      </Button>
      <Button variant="outline" asChild>
        <Link to="/explore">Browse projects</Link>
      </Button>
    </div>
  </div>
);

export default NotFound;

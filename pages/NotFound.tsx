import { Link } from "react-router-dom";
import { CampButton, EmptyState } from "@/components/camp/CampDesign";

const NotFound = () => (
  <div className="gpe-page flex min-h-screen items-center justify-center px-6 py-16 text-center">
    <EmptyState
      illustration="trail"
      title="Page not found"
      description="This trail does not lead to an active Hub page. Head back home or explore what the community is working on."
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/"><CampButton>Return Home</CampButton></Link>
          <Link to="/explore"><CampButton variant="outline">Browse Projects</CampButton></Link>
        </div>
      }
    />
  </div>
);

export default NotFound;

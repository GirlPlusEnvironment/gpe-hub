import { EmptyState } from "@/components/camp/CampDesign";

export default function Admin() {
  return (
    <div className="gpe-page flex min-h-screen items-center justify-center px-6 py-16">
      <EmptyState
        illustration="clipboard"
        title="Admin Dashboard"
        description="This legacy route is not wired into production navigation. Use the Team Review and Admin Dashboard routes for active tools."
      />
    </div>
  );
}

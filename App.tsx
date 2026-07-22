import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { FavoriteProvider } from "@/contexts/FavoriteContext";
import { MessagesProvider } from "@/contexts/MessagesContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import TeamRoute from "@/components/TeamRoute";
import { LoadingCampCard } from "@/components/camp/CampDesign";

const Index = lazy(() => import("./pages/Index"));
const Explore = lazy(() => import("./pages/Explore"));
const Community = lazy(() => import("./pages/Community"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const Messages = lazy(() => import("./pages/Messages"));
const Submit = lazy(() => import("./pages/Submit"));
const Profile = lazy(() => import("./pages/Profile"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const CampChallenges = lazy(() => import("./pages/CampChallenges"));
const MySubmissions = lazy(() => import("./pages/MySubmissions"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ListingDetailPage = lazy(() => import("./pages/ListingDetailPage"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CampAdmin = lazy(() => import("./pages/CampAdmin"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="gpe-page flex min-h-screen items-center justify-center px-6">
    <div className="w-full max-w-md">
      <LoadingCampCard label="Loading page" />
      <p className="mt-6 text-center font-bold uppercase">Loading the Hub...</p>
    </div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <FavoriteProvider>
          <MessagesProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/explore"
              element={
                <ProtectedRoute>
                  <Explore />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listing/:id"
              element={
                <ProtectedRoute>
                  <ListingDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/community"
              element={
                <ProtectedRoute>
                  <Community />
                </ProtectedRoute>
              }
            />
            <Route
              path="/community/post/:id"
              element={
                <ProtectedRoute>
                  <PostDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submit"
              element={
                <ProtectedRoute>
                  <Submit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submit/job"
              element={
                <ProtectedRoute>
                  <Submit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/favorites"
              element={
                <ProtectedRoute>
                  <Favorites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/submissions"
              element={
                <ProtectedRoute>
                  <MySubmissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <Leaderboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/camp-gpe"
              element={
                <ProtectedRoute>
                  <Leaderboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/camp-gpe/challenges"
              element={
                <ProtectedRoute>
                  <CampChallenges />
                </ProtectedRoute>
              }
            />
            <Route
              path="/camp-gpe/submissions"
              element={
                <ProtectedRoute>
                  <Leaderboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/camp-gpe/leaderboard"
              element={
                <ProtectedRoute>
                  <Leaderboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/camp"
              element={
                <ProtectedRoute>
                  <TeamRoute>
                    <CampAdmin />
                  </TeamRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminRoute>
                    <AdminDashboard />
                  </AdminRoute>
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/sign-up" element={<Navigate to="/login?mode=signup" replace />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <NotFound />
                </ProtectedRoute>
              }
            />
          </Routes>
          </Suspense>
        </BrowserRouter>
          </MessagesProvider>
        </FavoriteProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

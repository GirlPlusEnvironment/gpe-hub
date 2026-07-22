import { useCallback, useContext, useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Compass,
  Heart,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  ClipboardList,
  Shield,
  Trophy,
  User,
  Users,
  X,
  PlusCircle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { MessagesContext } from "@/contexts/messages-context";
import { PointsBadge } from "@/components/PointsBadge";
import { InstallAppButton } from "@/components/InstallAppButton";
import { cn } from "@/lib/utils";
import { getPreferredDisplayName, shortenEmail } from "@/lib/auth";
import { canManageCamp, isAdmin as checkIsAdmin } from "@/lib/roles";

const Header = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, loading } = useAuth();
  const messagesContext = useContext(MessagesContext);
  const unreadCount = messagesContext?.unreadCount ?? 0;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [role, setRole] = useState<"user" | "team_gpe" | "admin">("user");

  const loadRole = useCallback(async () => {
    if (!user) {
      setRole("user");
      return;
    }

    try {
      if (await checkIsAdmin()) setRole("admin");
      else if (await canManageCamp()) setRole("team_gpe");
      else setRole("user");
    } catch {
      setRole("user");
    }
  }, [user]);

  useEffect(() => {
    void loadRole();
  }, [loadRole]);

  useEffect(() => {
    const refreshRole = () => {
      if (document.visibilityState !== "hidden") {
        void loadRole();
      }
    };

    window.addEventListener("focus", refreshRole);
    document.addEventListener("visibilitychange", refreshRole);
    return () => {
      window.removeEventListener("focus", refreshRole);
      document.removeEventListener("visibilitychange", refreshRole);
    };
  }, [loadRole]);

  const displayName = getPreferredDisplayName({
    fullName: profile?.full_name,
    username: profile?.username,
    email: user?.email,
  });

  const avatarUrl =
    profile?.avatar_url ??
    ((user?.user_metadata?.avatar_url as string | undefined) ?? "");
  const resolvedAvatarUrl = avatarUrl.trim() || null;

  const secondaryIdentity =
    profile?.username
      ? `@${profile.username}`
      : user?.email
      ? shortenEmail(user.email)
      : "";

  const navItems = [
    { to: "/", label: "Dashboard", icon: Home },
    { to: "/explore", label: "Explore", icon: Compass },
    { to: "/community", label: "Community", icon: Users },
    { to: "/messages", label: "Messages", icon: MessageSquare, badge: unreadCount },
    { to: "/favorites", label: "Favorites", icon: Heart },
    { to: "/submit", label: "Submit New", icon: PlusCircle },
    { to: "/submissions", label: "My Submissions", icon: ClipboardList },
    { to: "/camp-gpe/challenges", label: "Seasonal Challenges", icon: Trophy },
    { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const renderNavLink = (
    item: (typeof navItems)[number] | { to: string; label: string; icon: typeof User; badge?: number },
    mobile = false,
  ) => {
    const Icon = item.icon;

    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={() => setIsMobileMenuOpen(false)}
        className={({ isActive }) =>
          cn(
            "gpe-pill gpe-press flex min-w-0 items-center justify-between gap-3 text-left transition-all",
            mobile ? "w-full px-4 py-3 text-sm" : "w-full px-5 py-4 text-sm",
            isActive ? "bg-black text-white" : "bg-white hover:bg-gpe-yellow",
          )
        }
      >
        <span className="flex items-center gap-3">
          <Icon className="h-5 w-5" />
          <span>{item.label}</span>
        </span>
        {item.badge && item.badge > 0 ? (
          <Badge className="min-w-7 justify-center bg-[#d53f8c] text-white">
            {item.badge > 99 ? "99+" : item.badge}
          </Badge>
        ) : null}
      </NavLink>
    );
  };

  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <>
      <div className="sticky top-0 z-40 border-b-[4px] border-black bg-gpe-pink md:hidden">
        <div className="flex min-w-0 items-center justify-between gap-2 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex min-w-0 shrink items-center"
            aria-label="Go to dashboard"
          >
            <img
              src="/logo.png"
              alt="GPE Hub"
              className="h-auto w-full max-w-[120px] object-contain sm:max-w-[140px]"
            />
          </button>
          <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            {user && <PointsBadge />}
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setIsMobileMenuOpen((previous) => !previous)}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 md:hidden">
          <div className="gpe-paper absolute left-0 top-0 flex h-full w-[min(88vw,320px)] max-w-full flex-col overflow-y-auto overflow-x-hidden border-r-[4px] border-black p-3 sm:p-4">
            <div className="mb-6 flex items-center justify-between">
              <img
                src="/logo.png"
                alt="GPE Hub"
                className="h-auto w-full max-w-[140px] object-contain"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Close menu"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex flex-1 flex-col gap-3">
              {navItems.map((item) => renderNavLink(item, true))}
              {role === "admin" &&
                renderNavLink({ to: "/admin", label: "Admin", icon: Shield }, true)}
              {(role === "admin" || role === "team_gpe") &&
                renderNavLink({ to: "/admin/camp", label: "Team Review", icon: Shield }, true)}
            </nav>

            <div className="mt-6 space-y-3 border-t-[4px] border-black pt-4">
              <InstallAppButton className="w-full" />

              <NavLink
                to="/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="gpe-card-sm flex items-start gap-3 bg-gpe-yellow p-3"
              >
                <Avatar className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-black">
                  <AvatarImage
                    src={resolvedAvatarUrl || undefined}
                    alt={displayName || "Profile photo"}
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                  <AvatarFallback className="bg-[#67e8f9] font-bold text-black">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="line-clamp-2 break-words text-sm font-bold leading-tight">
                    {displayName}
                  </div>
                <div className="break-words text-[11px] uppercase leading-tight text-black/60">
                    {secondaryIdentity || "Profile"}
                  </div>
                </div>
              </NavLink>

              <Button type="button" variant="ghost" className="justify-start px-0" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log Out
              </Button>
            </div>
          </div>
        </div>
      )}

      <aside className="gpe-paper fixed left-0 top-0 z-40 hidden h-screen w-[280px] flex-col border-r-[4px] border-black p-6 md:flex">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-10 flex items-center text-left"
          aria-label="Go to dashboard"
        >
          <img
            src="/logo.png"
            alt="GPE Hub"
            className="h-auto w-full max-w-[180px] object-contain"
          />
        </button>

        <div className="mb-5 -rotate-2 rounded-[1.25rem] border-[4px] border-black bg-gpe-pink px-4 py-2 text-center font-header text-sm uppercase text-white shadow-gpe-sm">
          Mission Control
        </div>

        <nav className="flex flex-1 flex-col gap-4">
          {navItems.map((item) => renderNavLink(item))}
          {role === "admin" && renderNavLink({ to: "/admin", label: "Admin", icon: Shield })}
          {(role === "admin" || role === "team_gpe") &&
            renderNavLink({ to: "/admin/camp", label: "Team Review", icon: Shield })}
        </nav>

        <div className="mt-6 space-y-4 border-t-[4px] border-black pt-4">
          {user && (
            <div className="flex items-center justify-between gap-3">
              <PointsBadge />
              {unreadCount > 0 ? (
                <Badge className="bg-[#d53f8c] text-white">{unreadCount > 99 ? "99+" : unreadCount}</Badge>
              ) : null}
            </div>
          )}

          <InstallAppButton className="w-full" />

          <NavLink to="/profile" className="gpe-card-sm flex items-start gap-3 bg-gpe-yellow p-3">
            <Avatar className="h-12 w-12 shrink-0 border-[3px] border-black">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="bg-[#67e8f9] font-bold text-black">
                {loading ? "…" : userInitial}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="line-clamp-2 break-words text-sm font-bold leading-tight">
                {displayName}
              </div>
              <div className="break-words text-[11px] uppercase leading-tight text-black/60">
                {secondaryIdentity || "View Profile"}
              </div>
            </div>
          </NavLink>

          <Button type="button" variant="ghost" className="justify-start px-0 text-red-500 hover:text-red-600" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </div>
      </aside>
    </>
  );
};

export default Header;

import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Menu, X, Heart, MessageSquare, Shield, Zap } from "lucide-react";
import headerLogo from "@/assets/header_logo.png";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useContext } from "react";
import { MessagesContext } from "@/contexts/MessagesContext";
import { PointsBadge } from "@/components/PointsBadge";

const Header = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, loading } = useAuth();
  const messagesContext = useContext(MessagesContext);
  const unreadCount = messagesContext?.unreadCount ?? 0;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [role, setRole] = useState<"user" | "admin">("user");

useEffect(() => {
  if (!user) {
    setRole("user");
    return;
  }

  (async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!error && data?.role === "admin") setRole("admin");
    else setRole("user");
  })();
}, [user?.id]);


  const displayName =
    profile?.full_name ??
    profile?.username ??
    user?.email ??
    "Community Member";

  const displayEmail = user?.email ?? "";

  const avatarUrl =
    profile?.avatar_url ??
    ((user?.user_metadata?.avatar_url as string | undefined) ?? "");

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="w-full bg-background border-b border-border">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            className="relative flex h-20 items-center overflow-visible rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-24 lg:h-28"
            onClick={closeMobileMenu}
          >
            <img
              src={headerLogo}
              alt="Girl + Environment Community Hub"
              className="h-full w-auto origin-left transform scale-[1.4] sm:scale-[1.8] md:scale-[2] lg:scale-[2.4]"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            <Link 
              to="/explore" 
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wide"
            >
              Explore
            </Link>
            <Link 
              to="/community" 
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wide"
            >
              My Community
            </Link>
            <Link 
              to="/submit" 
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wide"
            >
              Make a Submission
            </Link>
          </nav>

          {/* Desktop User Profile / Mobile Menu Button */}
          <div className="flex items-center gap-4">
            {/* User Points Badge - Desktop */}
            {user && (
              <div className="hidden md:block">
                <PointsBadge />
              </div>
            )}
            {/* Messages Icon Button - Desktop */}
            {user && (
              <Link
                to="/messages"
                className="hidden md:flex relative h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                aria-label="Messages"
              >
                <MessageSquare className="h-7 w-7 text-primary" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 text-xs flex items-center justify-center"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                )}
              </Link>
            )}
            {/* Desktop User Profile */}
            <div className="hidden md:block">
              {loading ? (
                <div
                  className="h-10 w-10 rounded-full bg-muted animate-pulse"
                  aria-hidden="true"
                />
              ) : user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus:outline-none">
                    <Avatar className="h-10 w-10 cursor-pointer border-2 border-primary/20 hover:border-primary transition-colors">
                      <AvatarImage key={avatarUrl} src={avatarUrl} alt={displayName} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 bg-card border-border z-50">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{displayName}</p>
                      {displayEmail && (
                        <p className="text-xs text-muted-foreground">{displayEmail}</p>
                      )}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link 
                        to="/favorites" 
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Heart className="h-4 w-4" />
                        <span>Favorites</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link 
                        to="/messages" 
                        className="flex items-center gap-2 cursor-pointer relative"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span>Messages</span>
                        {unreadCount > 0 && (
                          <Badge variant="destructive" className="h-4 min-w-4 px-1 text-xs ml-auto">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </Badge>
                        )}
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link 
                        to="/leaderboard" 
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Zap className="h-4 w-4" />
                        <span>Leaderboard</span>
                      </Link>
                    </DropdownMenuItem>

                    {role === "admin" && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link to="/admin" className="flex items-center gap-2 cursor-pointer">
                            <Shield className="h-4 w-4" />
                            <span>Admin Dashboard</span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}


                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link 
                        to="/profile" 
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <User className="h-4 w-4" />
                        <span>Edit Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Link to="/login">
                  <Button variant="outline" className="uppercase tracking-wide">
                    Log in
                  </Button>
                </Link>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-md hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6 text-primary" />
              ) : (
                <Menu className="h-6 w-6 text-primary" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-border">
            <nav className="flex flex-col space-y-4 pt-4">
              <Link
                to="/explore"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wide py-2"
                onClick={closeMobileMenu}
              >
                Explore
              </Link>
              <Link
                to="/community"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wide py-2"
                onClick={closeMobileMenu}
              >
                My Community
              </Link>
              <Link
                to="/submit"
                className="text-sm font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wide py-2"
                onClick={closeMobileMenu}
              >
                Make a Submission
              </Link>
              {user && (
                <Link
                  to="/messages"
                  className="relative text-sm font-medium text-primary hover:text-primary/80 transition-colors uppercase tracking-wide py-2 flex items-center gap-2"
                  onClick={closeMobileMenu}
                >
                  Messages
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Badge>
                  )}
                </Link>
              )}
              
              {/* Mobile User Section */}
              {loading ? (
                <div className="pt-4 border-t border-border">
                  <div className="h-8 w-8 rounded-full bg-muted animate-pulse" aria-hidden="true" />
                </div>
              ) : user ? (
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={avatarUrl} alt={displayName} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                        {displayEmail && (
                          <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <PointsBadge />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Link
                      to="/favorites"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                      onClick={closeMobileMenu}
                    >
                      <Heart className="h-4 w-4" />
                      <span>Favorites</span>
                    </Link>
                    <Link
                      to="/messages"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2 relative"
                      onClick={closeMobileMenu}
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>Messages</span>
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="h-4 min-w-4 px-1 text-xs ml-auto">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                    </Link>
                    <Link
                      to="/leaderboard"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                      onClick={closeMobileMenu}
                    >
                      <Zap className="h-4 w-4" />
                      <span>Leaderboard</span>
                    </Link>
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                      onClick={closeMobileMenu}
                    >
                      <User className="h-4 w-4" />
                      <span>Edit Profile</span>
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        closeMobileMenu();
                      }}
                      className="flex items-center gap-2 text-sm text-destructive hover:text-destructive/80 transition-colors py-2 w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t border-border">
                  <Link to="/login" onClick={closeMobileMenu}>
                    <Button variant="outline" className="w-full uppercase tracking-wide">
                      Log in
                    </Button>
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;

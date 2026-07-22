import { useState, useEffect, useCallback, useRef } from "react";
import { Search, User, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/use-debounce";
import type { Profile } from "@/types/messages";

interface UserSearchProps {
  onSelectUsers: (profileIds: string[], groupName?: string) => void;
  onCancel: () => void;
  excludeIds?: string[];
  actionLabel?: string;
  suggestedUsers?: Profile[];
}

const UserSearch = ({ onSelectUsers, onCancel, excludeIds = [], actionLabel, suggestedUsers = [] }: UserSearchProps) => {
  const { searchUsers } = useMessages();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const searchRequestIdRef = useRef(0);
  
  // Memoize excludeIds to prevent infinite loops
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    // Increment request ID for this search
    const currentRequestId = ++searchRequestIdRef.current;
    setIsSearching(true);
    
    try {
      // Exclude current user and any provided excludeIds from search results
      const allExcludeIds = [
        ...(profile?.id ? [profile.id] : []),
        ...excludeIds,
      ];
      const users = await searchUsers(searchQuery, allExcludeIds);
      
      // Only update results if this is still the latest search request
      if (currentRequestId === searchRequestIdRef.current) {
        setResults(users);
        setIsSearching(false);
      }
    } catch (error) {
      console.error("Failed to search users", error);
      // Only update results if this is still the latest search request
      if (currentRequestId === searchRequestIdRef.current) {
        setResults([]);
        setIsSearching(false);
      }
    }
  }, [searchUsers, profile?.id, excludeIds]);

  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  const handleToggleUser = (user: Profile) => {
    // Prevent selecting yourself
    if (user.id === profile?.id) {
      return;
    }
    
    setSelectedUsers((prev) => {
      const isSelected = prev.some((u) => u.id === user.id);
      if (isSelected) {
        return prev.filter((u) => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreateConversation = () => {
    if (selectedUsers.length === 0) return;
    const profileIds = selectedUsers.map((u) => u.id);
    const name = groupName.trim() || undefined;
    // Reset state before calling callback
    setSelectedUsers([]);
    setGroupName("");
    setQuery("");
    onSelectUsers(profileIds, name);
  };

  const handleCancel = () => {
    setSelectedUsers([]);
    setGroupName("");
    setQuery("");
    onCancel();
  };

  const isUserSelected = (userId: string) => {
    return selectedUsers.some((u) => u.id === userId);
  };

  return (
    <div className="border border-border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Start a new conversation</h3>
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Selected Users */}
      {selectedUsers.length > 0 && (
        <div className="mb-4">
          <Label className="text-sm font-medium mb-2 block">Selected ({selectedUsers.length})</Label>
          <div className="flex flex-wrap gap-2">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full text-sm"
              >
                <span className="truncate max-w-[150px]">
                  {user.full_name || user.username || "Unknown"}
                </span>
                <button
                  onClick={() => handleRemoveUser(user.id)}
                  className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Name Input (only show if 2+ users selected) */}
      {selectedUsers.length >= 2 && (
        <div className="mb-4">
          <Label htmlFor="group-name" className="text-sm font-medium mb-2 block">
            Group Name (optional)
          </Label>
          <Input
            id="group-name"
            placeholder="Enter group name..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or username..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isSearching && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Searching...
        </div>
      )}

      {!isSearching && query.trim() && results.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No users found
        </div>
      )}

      {!query.trim() && suggestedUsers.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-2 px-1">Recent</h4>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {suggestedUsers.map((user) => {
              const isSelected = isUserSelected(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => handleToggleUser(user)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                  }`}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.full_name?.charAt(0).toUpperCase() ||
                          user.username?.charAt(0).toUpperCase() ||
                          "U"}
                      </AvatarFallback>
                    </Avatar>
                    {isSelected && (
                      <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {user.full_name || user.username || "Unknown User"}
                    </p>
                    {user.username && user.full_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        @{user.username}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto mb-4">
          {results.map((user) => {
            const isSelected = isUserSelected(user.id);
            return (
              <button
                key={user.id}
                onClick={() => handleToggleUser(user)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                  isSelected ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                }`}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user.full_name?.charAt(0).toUpperCase() ||
                        user.username?.charAt(0).toUpperCase() ||
                        "U"}
                    </AvatarFallback>
                  </Avatar>
                  {isSelected && (
                    <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {user.full_name || user.username || "Unknown User"}
                  </p>
                  {user.username && user.full_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      @{user.username}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Button */}
      {selectedUsers.length > 0 && (
        <div className="flex gap-2">
          <Button
            onClick={handleCreateConversation}
            className="flex-1"
            disabled={selectedUsers.length === 0}
          >
            {actionLabel 
              ? actionLabel 
              : selectedUsers.length === 1
                ? "Start Conversation"
                : selectedUsers.length === 2
                  ? "Create Group Chat"
                  : `Create Group (${selectedUsers.length})`}
          </Button>
        </div>
      )}

      {!query.trim() && suggestedUsers.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          Start typing to search for users
        </div>
      )}
    </div>
  );
};

export default UserSearch;

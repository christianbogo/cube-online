import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert, Search, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const getRelativeLastSeen = (isoString?: string) => {
    if (!isoString) return 'Offline';
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (isNaN(diffMs) || diffMs < 0) return 'Offline';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
};

const isUserOnline = (u: any) => {
    if (!u.lastSeenAt || u.status === 'Offline') return false;
    const diffMs = Date.now() - new Date(u.lastSeenAt).getTime();
    return diffMs < 300000; // 5 minutes
};

export default function CubingFriendsTab() {
    const { user, toggleFollowUser } = useAuth();
    const navigate = useNavigate();

    // Search State
    const [searchQueryText, setSearchQueryText] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Connection Lists & Loading States
    const [followingList, setFollowingList] = useState<any[]>([]);
    const [followersList, setFollowersList] = useState<any[]>([]);
    const [isLoadingConnections, setIsLoadingConnections] = useState(true);
    const [actionLoadingUid, setActionLoadingUid] = useState<string | null>(null);

    const [, setTick] = useState(0);

    // Periodic tick to refresh relative last online times
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    const followingIds = useMemo(() => {
        return user?.following || user?.starredUsers || [];
    }, [user?.following, user?.starredUsers]);

    // Fetch Lists
    useEffect(() => {
        if (!user) {
            setIsLoadingConnections(false);
            return;
        }

        let isMounted = true;

        const fetchData = async () => {
            try {
                // 1. Fetch Following (Users I follow)
                let myFollowing: any[] = [];
                if (followingIds.length > 0) {
                    const snaps = await Promise.all(followingIds.map((uid: string) => getDoc(doc(db, 'users', uid))));
                    myFollowing = snaps.filter(s => s.exists()).map(s => ({ uid: s.id, ...s.data() }));
                }

                // 2. Fetch Followers (Users who follow ME)
                const qFollowing = query(collection(db, 'users'), where('following', 'array-contains', user.uid));
                const qStarred = query(collection(db, 'users'), where('starredUsers', 'array-contains', user.uid));

                const [snapFollowing, snapStarred] = await Promise.all([
                    getDocs(qFollowing).catch(() => ({ docs: [] })),
                    getDocs(qStarred).catch(() => ({ docs: [] }))
                ]);

                const followerMap = new Map<string, any>();
                snapFollowing.docs.forEach(d => followerMap.set(d.id, { uid: d.id, ...d.data() }));
                snapStarred.docs.forEach(d => followerMap.set(d.id, { uid: d.id, ...d.data() }));

                const myFollowers = Array.from(followerMap.values()).filter((u: any) => u.uid !== user.uid);

                if (isMounted) {
                    setFollowingList(myFollowing);
                    setFollowersList(myFollowers);
                    setIsLoadingConnections(false);
                }
            } catch (e) {
                console.error("Error fetching connections", e);
                if (isMounted) {
                    setIsLoadingConnections(false);
                }
            }
        };

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [user, followingIds]);

    const followerUids = useMemo(() => {
        return new Set(followersList.map(u => u.uid));
    }, [followersList]);

    // Handle Follow/Unfollow Click
    const handleFollowClick = async (targetUid: string) => {
        setActionLoadingUid(targetUid);
        try {
            await toggleFollowUser(targetUid);
        } catch (e) {
            console.error("Error toggling follow:", e);
        } finally {
            setActionLoadingUid(null);
        }
    };

    // Search by username or Short ID
    const handleSearch = useCallback(async (text: string) => {
        setSearchQueryText(text);
        const trimmed = text.trim();
        if (!trimmed) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const cleanShortId = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
            const usersRef = collection(db, 'users');

            const [byShortId, byUsername] = await Promise.all([
                getDocs(query(usersRef, where('shortId', '==', cleanShortId))),
                getDocs(query(usersRef, where('username', '>=', trimmed), where('username', '<=', trimmed + '\uf8ff')))
            ]);

            const resultMap = new Map<string, any>();
            byShortId.docs.forEach(d => {
                if (d.id !== user?.uid) resultMap.set(d.id, { uid: d.id, ...d.data() });
            });
            byUsername.docs.forEach(d => {
                if (d.id !== user?.uid) resultMap.set(d.id, { uid: d.id, ...d.data() });
            });

            setSearchResults(Array.from(resultMap.values()));
        } catch (e) {
            console.error("Search error", e);
        } finally {
            setIsSearching(false);
        }
    }, [user?.uid]);

    if (!user?.emailVerified) {
        return (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                <p className="text-sm text-yellow-500 flex items-center gap-2">
                    <TriangleAlert className="w-4 h-4" />
                    Please verify your email to access social features.
                </p>
            </div>
        );
    }

    const ConnectionSkeleton = () => (
        <div className="flex items-center justify-between p-2.5 sm:p-3 bg-surface-elevation-1 rounded-xl border border-border/40 animate-pulse min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-bg-secondary/80 shrink-0" />
                <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="w-20 sm:w-24 h-3 sm:h-3.5 bg-bg-secondary/80 rounded" />
                    <div className="w-12 sm:w-14 h-2 sm:h-2.5 bg-bg-secondary/60 rounded" />
                </div>
            </div>
            <div className="w-14 sm:w-16 h-6 bg-bg-secondary/80 rounded-md shrink-0" />
        </div>
    );

    const onSearchSubmit = () => handleSearch(searchQueryText);

    const UserConnectionCard = ({
        targetUser
    }: {
        targetUser: any;
    }) => {
        const isFollowing = followingIds.includes(targetUser.uid);
        const isFollower = followerUids.has(targetUser.uid) ||
            targetUser.following?.includes(user?.uid) ||
            targetUser.starredUsers?.includes(user?.uid);
        const isActionLoading = actionLoadingUid === targetUser.uid;
        const isOnline = isUserOnline(targetUser);

        return (
            <div className="flex items-center justify-between p-2.5 sm:p-3 bg-surface-elevation-1 rounded-xl border border-border/60 hover:border-accent/40 transition-all group min-w-0">
                <div
                    className="flex items-center gap-2.5 min-w-0 cursor-pointer mr-1.5"
                    onClick={() => navigate(`/social/${targetUser.shortId || targetUser.uid}`)}
                >
                    {/* User Avatar */}
                    <div className="relative shrink-0">
                        <div
                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-sm transition-transform group-hover:scale-105"
                            style={{ backgroundColor: targetUser.color || '#3b82f6' }}
                        />
                        {isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-surface-elevation-1 rounded-full shadow-xs" />
                        )}
                    </div>

                    <div className="flex flex-col min-w-0 justify-center">
                        <span className="text-sm sm:text-base font-bold text-text-primary truncate group-hover:text-accent transition-colors leading-tight">
                            {targetUser.username || 'CubingUser'}
                        </span>

                        {/* Status: Online vs Last online */}
                        <div className="flex items-center gap-1.5 mt-0.5 leading-none">
                            {isOnline ? (
                                <span className="text-[10px] sm:text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1 leading-none shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                                    Online
                                </span>
                            ) : (
                                <span className="text-[10px] sm:text-[11px] text-text-secondary leading-none truncate">
                                    Last online {getRelativeLastSeen(targetUser.lastSeenAt)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions - visible on card hover (desktop) or always visible (mobile) */}
                <div className={`flex items-center gap-1 shrink-0 transition-opacity duration-150 ${isActionLoading ? 'opacity-100' : 'sm:opacity-0 sm:group-hover:opacity-100 opacity-100 focus-within:opacity-100'}`}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleFollowClick(targetUser.uid);
                        }}
                        disabled={isActionLoading}
                        className={`group/btn inline-flex items-center justify-center gap-1 px-2.5 py-0.5 min-w-[76px] rounded-md bg-bg-secondary/70 border border-border/40 text-[11px] font-mono transition-colors cursor-pointer disabled:opacity-60 leading-tight ${
                            isFollowing
                                ? 'text-text-secondary hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10'
                                : 'text-text-secondary hover:text-text-primary hover:border-border'
                        }`}
                        title={isFollowing ? 'Unfollow' : isFollower ? 'Follow back' : 'Follow'}
                    >
                        {isActionLoading ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        ) : isFollowing ? (
                            <>
                                <span className="group-hover/btn:hidden">Following</span>
                                <span className="hidden group-hover/btn:inline">Unfollow</span>
                            </>
                        ) : isFollower ? (
                            <span>Follow Back</span>
                        ) : (
                            <span>Follow</span>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-5 p-2">
            {/* Top Bar: Find Cuber Search Bar */}
            <div className="flex items-center gap-2.5 sm:gap-3 p-1.5 pl-3.5 sm:pl-4 bg-bg-secondary/40 rounded-xl border border-border/60 w-full focus-within:border-accent transition-colors">
                <span className="text-xs font-bold text-text-secondary uppercase tracking-wider shrink-0 select-none">
                    Find Cuber
                </span>
                <div className="relative flex-1 flex items-center min-w-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary shrink-0 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Enter friend code or username..."
                        value={searchQueryText}
                        onChange={(e) => setSearchQueryText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                        className="w-full bg-transparent pl-8 pr-2 py-1 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none min-w-0"
                        maxLength={20}
                    />
                </div>
                <button
                    onClick={onSearchSubmit}
                    className="px-3.5 sm:px-4 py-1.5 bg-text-primary text-bg-primary font-bold rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    disabled={isSearching || !searchQueryText.trim()}
                >
                    {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSearching ? 'Searching...' : 'Search'}</span>
                </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div className="flex flex-col gap-2.5 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Search Results ({searchResults.length})</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {searchResults.map(u => (
                            <UserConnectionCard key={u.uid} targetUser={u} />
                        ))}
                    </div>
                    <hr className="border-border/40 my-1" />
                </div>
            )}
            {searchQueryText && !isSearching && searchResults.length === 0 && (
                <p className="text-xs text-text-secondary italic">No users found matching &quot;{searchQueryText}&quot;.</p>
            )}

            {/* Following Section */}
            <div className="flex flex-col gap-3">
                {isLoadingConnections ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <ConnectionSkeleton />
                        <ConnectionSkeleton />
                    </div>
                ) : followingList.length === 0 ? (
                    <div className="p-6 text-center bg-bg-secondary/20 rounded-xl border border-dashed border-border/60">
                        <p className="text-xs text-text-secondary italic">
                            You are not following anyone yet. Search by code or username above to follow fellow cubers.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {followingList.map(u => (
                            <UserConnectionCard key={u.uid} targetUser={u} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

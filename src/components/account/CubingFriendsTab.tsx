import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TriangleAlert, Users, Copy, Search, UserCheck, Ban, Loader2, ChevronDown } from 'lucide-react';
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
    if (!u?.lastSeenAt) return false;
    const lastSeenTime = new Date(u.lastSeenAt).getTime();
    return (Date.now() - lastSeenTime) <= 5 * 60 * 1000;
};

export default function CubingFriendsTab() {
    const { user, toggleFollowUser, toggleBlockUser } = useAuth();
    const navigate = useNavigate();

    // Search State
    const [searchQueryText, setSearchQueryText] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Connection Lists & Loading States
    const [followingList, setFollowingList] = useState<any[]>([]);
    const [followersList, setFollowersList] = useState<any[]>([]);
    const [blockedList, setBlockedList] = useState<any[]>([]);
    const [isLoadingConnections, setIsLoadingConnections] = useState(true);
    const [actionLoadingUid, setActionLoadingUid] = useState<string | null>(null);

    // Section collapse states (closed by default)
    const [isFollowingOpen, setIsFollowingOpen] = useState(false);
    const [isFollowersOpen, setIsFollowersOpen] = useState(false);

    const [copiedId, setCopiedId] = useState(false);
    const [, setTick] = useState(0);

    // Periodic tick to refresh relative last online times
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    const followingIds = useMemo(() => {
        return user?.following || user?.starredUsers || [];
    }, [user?.following, user?.starredUsers]);

    const blockedIds = useMemo(() => {
        return user?.blockedUsers || [];
    }, [user?.blockedUsers]);

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

                // 2. Fetch Blocked
                let myBlocked: any[] = [];
                if (blockedIds.length > 0) {
                    const snaps = await Promise.all(blockedIds.map((uid: string) => getDoc(doc(db, 'users', uid))));
                    myBlocked = snaps.filter(s => s.exists()).map(s => ({ uid: s.id, ...s.data() }));
                }

                // 3. Fetch Followers (Users who follow ME)
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
                    setBlockedList(myBlocked);
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
    }, [user, followingIds, blockedIds]);

    const followerUids = useMemo(() => {
        return new Set(followersList.map(u => u.uid));
    }, [followersList]);

    const onlineFollowing = useMemo(() => followingList.filter(isUserOnline), [followingList]);
    const displayedFollowing = isFollowingOpen ? followingList : onlineFollowing;

    const onlineFollowers = useMemo(() => followersList.filter(isUserOnline), [followersList]);
    const displayedFollowers = isFollowersOpen ? followersList : onlineFollowers;

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

    // Handle Block/Unblock Click
    const handleBlockClick = async (targetUid: string) => {
        setActionLoadingUid(targetUid);
        try {
            await toggleBlockUser(targetUid);
        } catch (e) {
            console.error("Error toggling block:", e);
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

    const copyMyCode = () => {
        if (user?.shortId) {
            navigator.clipboard.writeText(user.shortId);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        }
    };

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
        <div className="flex items-center justify-between p-3 bg-surface-elevation-1 rounded-xl border border-border/40 animate-pulse">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-bg-secondary/80 shrink-0" />
                <div className="flex flex-col gap-1.5">
                    <div className="w-24 h-3.5 bg-bg-secondary/80 rounded" />
                    <div className="w-14 h-2.5 bg-bg-secondary/60 rounded" />
                </div>
            </div>
            <div className="w-20 h-7 bg-bg-secondary/80 rounded-lg" />
        </div>
    );

    const onSearchSubmit = () => handleSearch(searchQueryText);

    const UserConnectionCard = ({
        targetUser,
        isBlockedSection = false
    }: {
        targetUser: any;
        isBlockedSection?: boolean;
    }) => {
        const isFollowing = followingIds.includes(targetUser.uid);
        const isFollower = followerUids.has(targetUser.uid) ||
            targetUser.following?.includes(user?.uid) ||
            targetUser.starredUsers?.includes(user?.uid);
        const isBlocked = blockedIds.includes(targetUser.uid);
        const isActionLoading = actionLoadingUid === targetUser.uid;
        const isOnline = isUserOnline(targetUser);

        return (
            <div className="flex items-center justify-between p-3 bg-surface-elevation-1 rounded-xl border border-border/60 hover:border-accent/40 transition-all group">
                <div
                    className="flex items-center gap-3 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/social/${targetUser.uid}`)}
                >
                    {/* User Avatar */}
                    <div className="relative shrink-0">
                        <div
                            className="w-10 h-10 rounded-xl shadow-sm transition-transform group-hover:scale-105"
                            style={{ backgroundColor: targetUser.color || '#3b82f6' }}
                        />
                        {isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-surface-elevation-1 rounded-full shadow-xs" />
                        )}
                    </div>

                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap leading-none">
                            <span className="text-sm font-bold text-text-primary truncate group-hover:text-accent transition-colors leading-tight">
                                {targetUser.username || 'CubingUser'}
                            </span>

                            {/* Status: Online vs Last online */}
                            {isOnline ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1 leading-none">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                                    Online
                                </span>
                            ) : (
                                <span className="text-[11px] text-text-secondary leading-none">
                                    Last online {getRelativeLastSeen(targetUser.lastSeenAt)}
                                </span>
                            )}
                        </div>

                        {/* Short ID with Copy */}
                        <div
                            className="flex items-center gap-1 text-xs text-text-secondary group/code cursor-pointer w-fit mt-0 hover:text-text-primary transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(targetUser.shortId || '');
                            }}
                            title="Click to copy ID"
                        >
                            <span className="font-mono">#{targetUser.shortId || '????'}</span>
                            <Copy className="w-3 h-3 opacity-0 group-hover/code:opacity-100 transition-opacity" />
                        </div>
                    </div>
                </div>

                {/* Actions - only visible on hover (or while action is loading) */}
                <div className={`flex items-center gap-1.5 shrink-0 transition-opacity duration-150 ${isActionLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
                    {!isBlockedSection && (
                        <button
                            onClick={() => handleFollowClick(targetUser.uid)}
                            disabled={isActionLoading}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-secondary/60 border border-border/40 text-xs text-text-secondary font-mono hover:text-text-primary hover:border-border transition-colors cursor-pointer disabled:opacity-60"
                            title={isFollowing ? 'Unfollow' : isFollower ? 'Follow back' : 'Follow'}
                        >
                            {isActionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>{isFollowing ? 'Following' : isFollower ? 'Follow Back' : 'Follow'}</span>
                        </button>
                    )}

                    <button
                        onClick={() => handleBlockClick(targetUser.uid)}
                        disabled={isActionLoading}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-secondary/60 border border-border/40 text-xs text-text-secondary font-mono hover:text-red-500 hover:border-red-500/30 transition-colors cursor-pointer disabled:opacity-60"
                        title={isBlocked ? 'Unblock user' : 'Block user'}
                    >
                        {isActionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>{isBlocked ? 'Unblock' : 'Block'}</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 p-2">
            {/* Top Row: My Friend Code & Find User */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* My Friend Code Card */}
                <div className="flex items-center justify-between p-3.5 bg-bg-secondary/40 rounded-xl border border-border/40 h-full">
                    <div className="flex flex-col justify-center">
                        <span className="text-xs font-semibold text-text-secondary uppercase">My Friend Code</span>
                        <div className="flex items-center gap-2 mt-1 cursor-pointer" onClick={copyMyCode} title="Click to copy code">
                            <span className="text-xl font-mono font-bold text-text-primary">#{user?.shortId || 'Pending...'}</span>
                            <Copy className={`w-4 h-4 ${copiedId ? 'text-green-500' : 'text-text-primary'}`} />
                        </div>
                    </div>
                    {copiedId && <span className="text-xs text-green-500 font-bold animate-in fade-in">Copied!</span>}
                </div>

                {/* Find User Card */}
                <div className="flex flex-col justify-between p-3.5 bg-bg-secondary/40 rounded-xl border border-border/40 gap-2 h-full">
                    <label className="text-xs font-semibold text-text-secondary uppercase">Find Cuber</label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                            <input
                                type="text"
                                placeholder="Enter friend code or username..."
                                value={searchQueryText}
                                onChange={(e) => setSearchQueryText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                                className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                                maxLength={20}
                            />
                        </div>
                        <button
                            onClick={onSearchSubmit}
                            className="px-4 py-1.5 bg-text-primary text-bg-primary font-bold rounded-lg text-sm hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            disabled={isSearching || !searchQueryText.trim()}
                        >
                            {isSearching && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>{isSearching ? 'Searching...' : 'Search'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
                <div className="flex flex-col gap-2.5 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Search Results ({searchResults.length})</span>
                    <div className="flex flex-col gap-2">
                        {searchResults.map(u => (
                            <UserConnectionCard key={u.uid} targetUser={u} />
                        ))}
                    </div>
                </div>
            )}
            {searchQueryText && !isSearching && searchResults.length === 0 && (
                <p className="text-xs text-text-secondary italic">No users found matching &quot;{searchQueryText}&quot;.</p>
            )}

            <hr className="border-border/40" />

            {/* Following Section */}
            <div className="flex flex-col gap-3">
                <div
                    className="flex items-center justify-between cursor-pointer group/header select-none"
                    onClick={() => setIsFollowingOpen(prev => !prev)}
                >
                    <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-accent" />
                        <h4 className="text-sm font-bold text-text-primary group-hover/header:text-accent transition-colors">
                            Following
                        </h4>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary border border-border">
                            {isLoadingConnections ? '...' : followingList.length}
                        </span>
                        {!isFollowingOpen && onlineFollowing.length > 0 && (
                            <span className="text-[11px] font-medium text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                                {onlineFollowing.length} online
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
                        aria-label={isFollowingOpen ? "Close following section" : "Open following section"}
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFollowingOpen ? '' : '-rotate-90'}`} />
                    </button>
                </div>

                {isLoadingConnections ? (
                    <div className="flex flex-col gap-2">
                        <ConnectionSkeleton />
                        <ConnectionSkeleton />
                    </div>
                ) : followingList.length === 0 ? (
                    <div className="p-6 text-center bg-bg-secondary/20 rounded-xl border border-dashed border-border/60">
                        <p className="text-xs text-text-secondary italic">
                            You are not following anyone yet. Search by code or username above to follow fellow cubers.
                        </p>
                    </div>
                ) : displayedFollowing.length === 0 ? (
                    <div className="p-4 text-center bg-bg-secondary/10 rounded-xl border border-border/30 flex flex-col items-center gap-1.5">
                        <p className="text-xs text-text-secondary italic">
                            No one you follow is online right now.
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsFollowingOpen(true)}
                            className="text-xs font-semibold text-accent hover:underline cursor-pointer"
                        >
                            Show all {followingList.length} following
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {displayedFollowing.map(u => (
                            <UserConnectionCard key={u.uid} targetUser={u} />
                        ))}
                        {!isFollowingOpen && followingList.length > onlineFollowing.length && (
                            <button
                                type="button"
                                onClick={() => setIsFollowingOpen(true)}
                                className="py-1.5 text-xs text-text-secondary hover:text-accent font-medium text-center transition-colors cursor-pointer"
                            >
                                Show {followingList.length - onlineFollowing.length} more offline
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Followers Section */}
            <div className="flex flex-col gap-3">
                <div
                    className="flex items-center justify-between cursor-pointer group/header select-none"
                    onClick={() => setIsFollowersOpen(prev => !prev)}
                >
                    <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-text-secondary" />
                        <h4 className="text-sm font-bold text-text-primary group-hover/header:text-accent transition-colors">
                            Followers
                        </h4>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary border border-border">
                            {isLoadingConnections ? '...' : followersList.length}
                        </span>
                        {!isFollowersOpen && onlineFollowers.length > 0 && (
                            <span className="text-[11px] font-medium text-green-500 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                                {onlineFollowers.length} online
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors cursor-pointer"
                        aria-label={isFollowersOpen ? "Close followers section" : "Open followers section"}
                    >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isFollowersOpen ? '' : '-rotate-90'}`} />
                    </button>
                </div>

                {isLoadingConnections ? (
                    <div className="flex flex-col gap-2">
                        <ConnectionSkeleton />
                    </div>
                ) : followersList.length === 0 ? (
                    <div className="p-6 text-center bg-bg-secondary/20 rounded-xl border border-dashed border-border/60">
                        <p className="text-xs text-text-secondary italic">
                            No followers yet. Share your friend code #{user?.shortId || '...'} with friends!
                        </p>
                    </div>
                ) : displayedFollowers.length === 0 ? (
                    <div className="p-4 text-center bg-bg-secondary/10 rounded-xl border border-border/30 flex flex-col items-center gap-1.5">
                        <p className="text-xs text-text-secondary italic">
                            No followers are online right now.
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsFollowersOpen(true)}
                            className="text-xs font-semibold text-accent hover:underline cursor-pointer"
                        >
                            Show all {followersList.length} followers
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {displayedFollowers.map(u => (
                            <UserConnectionCard key={u.uid} targetUser={u} />
                        ))}
                        {!isFollowersOpen && followersList.length > onlineFollowers.length && (
                            <button
                                type="button"
                                onClick={() => setIsFollowersOpen(true)}
                                className="py-1.5 text-xs text-text-secondary hover:text-accent font-medium text-center transition-colors cursor-pointer"
                            >
                                Show {followersList.length - onlineFollowers.length} more offline
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Blocked Users Section */}
            {(isLoadingConnections || blockedList.length > 0) && (
                <div className="flex flex-col gap-3 pt-2">
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-500" />
                        <span>Blocked</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                            {isLoadingConnections ? '...' : blockedList.length}
                        </span>
                    </h4>
                    {isLoadingConnections ? (
                        <ConnectionSkeleton />
                    ) : (
                        <div className="flex flex-col gap-2">
                            {blockedList.map(u => (
                                <UserConnectionCard key={u.uid} targetUser={u} isBlockedSection={true} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

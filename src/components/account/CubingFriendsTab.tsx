import { useState, useEffect, useMemo, useCallback } from 'react';
import { TriangleAlert, Ban, Users, Copy, Search, UserCheck, UserPlus, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function CubingFriendsTab() {
    const { user, toggleFollowUser, toggleBlockUser } = useAuth();

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

    const [copiedId, setCopiedId] = useState(false);

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
    }, [user?.uid, followingIds, blockedIds]);

    const followerUids = useMemo(() => {
        return new Set(followersList.map(f => f.uid));
    }, [followersList]);

    const handleFollowClick = useCallback(async (targetUid: string) => {
        setActionLoadingUid(targetUid);
        try {
            await toggleFollowUser(targetUid);
        } finally {
            setActionLoadingUid(null);
        }
    }, [toggleFollowUser]);

    const handleBlockClick = useCallback(async (targetUid: string) => {
        setActionLoadingUid(targetUid);
        try {
            await toggleBlockUser(targetUid);
        } finally {
            setActionLoadingUid(null);
        }
    }, [toggleBlockUser]);

    const handleSearch = async () => {
        const queryClean = searchQueryText.trim();
        if (!queryClean) return;
        setIsSearching(true);
        try {
            // Search by shortId first (case sensitive / exact)
            const qShortId = query(collection(db, 'users'), where('shortId', '==', queryClean));
            const snapShort = await getDocs(qShortId);

            const foundMap = new Map<string, any>();
            snapShort.docs.forEach(d => foundMap.set(d.id, { uid: d.id, ...d.data() }));

            // If empty and longer search, also try username exact match
            if (foundMap.size === 0 && queryClean.length >= 2) {
                const qUser = query(collection(db, 'users'), where('username', '==', queryClean));
                const snapUser = await getDocs(qUser);
                snapUser.docs.forEach(d => foundMap.set(d.id, { uid: d.id, ...d.data() }));
            }

            const results = Array.from(foundMap.values()).filter(u => u.uid !== user?.uid);
            setSearchResults(results);
        } catch (e) {
            console.error("Error searching users", e);
        } finally {
            setIsSearching(false);
        }
    };

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
        <div className="flex items-center justify-between p-3 bg-surface-elevation-1/50 rounded-xl border border-border/30 animate-pulse">
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
        const isMutual = isFollowing && isFollower;
        const isActionLoading = actionLoadingUid === targetUser.uid;

        return (
            <div className="flex items-center justify-between p-3 bg-surface-elevation-1 rounded-xl border border-border/60 hover:border-accent/40 transition-all group">
                <div className="flex items-center gap-3 min-w-0">
                    {/* User Avatar */}
                    <div
                        className="w-10 h-10 rounded-xl shadow-sm flex items-center justify-center font-bold text-white text-sm shrink-0"
                        style={{ backgroundColor: targetUser.color || '#3b82f6' }}
                    >
                        {(targetUser.username || 'U').charAt(0).toUpperCase()}
                    </div>

                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-text-primary truncate">
                                {targetUser.username || 'CubingUser'}
                            </span>

                            {/* Relationship Badges */}
                            {isMutual ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    Mutual
                                </span>
                            ) : isFollower && !isFollowing ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                                    Follows You
                                </span>
                            ) : null}
                        </div>

                        {/* Short ID with Copy */}
                        <div
                            className="flex items-center gap-1 text-xs text-text-secondary group/code cursor-pointer w-fit mt-0.5 hover:text-text-primary transition-colors"
                            onClick={() => navigator.clipboard.writeText(targetUser.shortId || '')}
                            title="Click to copy ID"
                        >
                            <span className="font-mono">#{targetUser.shortId || '????'}</span>
                            <Copy className="w-3 h-3 opacity-0 group-hover/code:opacity-100 transition-opacity" />
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    {!isBlockedSection && (
                        <>
                            {isFollowing ? (
                                <button
                                    onClick={() => handleFollowClick(targetUser.uid)}
                                    disabled={isActionLoading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-secondary hover:bg-red-500/10 text-text-secondary hover:text-red-500 border border-border transition-colors cursor-pointer disabled:opacity-60"
                                    title="Unfollow cuber"
                                >
                                    {isActionLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                                    ) : (
                                        <UserCheck className="w-3.5 h-3.5 text-accent" />
                                    )}
                                    <span>Following</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleFollowClick(targetUser.uid)}
                                    disabled={isActionLoading}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:brightness-110 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                                    title={isFollower ? "Follow back" : "Follow"}
                                >
                                    {isActionLoading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                                    ) : (
                                        <UserPlus className="w-3.5 h-3.5" />
                                    )}
                                    <span>{isFollower ? 'Follow Back' : 'Follow'}</span>
                                </button>
                            )}
                        </>
                    )}

                    <button
                        onClick={() => handleBlockClick(targetUser.uid)}
                        disabled={isActionLoading}
                        className={`p-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-60 ${
                            isBlocked
                                ? 'text-red-500 bg-red-500/10 border-red-500/30'
                                : 'text-text-secondary hover:text-red-500 border-border hover:bg-bg-tertiary'
                        }`}
                        title={isBlocked ? "Unblock user" : "Block user"}
                    >
                        {isActionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Ban className="w-4 h-4" />
                        )}
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
                <div className="flex items-center justify-between p-4 bg-accent/10 rounded-xl border border-accent/20 h-full">
                    <div className="flex flex-col justify-center">
                        <span className="text-xs text-accent font-bold uppercase tracking-wider">My Friend Code</span>
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
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                                maxLength={20}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
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
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-accent" />
                        <span>Following</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary border border-border">
                            {isLoadingConnections ? '...' : followingList.length}
                        </span>
                    </h4>
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
                ) : (
                    <div className="flex flex-col gap-2">
                        {followingList.map(u => (
                            <UserConnectionCard key={u.uid} targetUser={u} />
                        ))}
                    </div>
                )}
            </div>

            {/* Followers Section */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                        <Users className="w-4 h-4 text-text-secondary" />
                        <span>Followers</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary border border-border">
                            {isLoadingConnections ? '...' : followersList.length}
                        </span>
                    </h4>
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
                ) : (
                    <div className="flex flex-col gap-2">
                        {followersList.map(u => (
                            <UserConnectionCard key={u.uid} targetUser={u} />
                        ))}
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

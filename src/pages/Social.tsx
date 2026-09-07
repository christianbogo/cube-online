import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserData } from '../types';
import { SocialLeaderboardCard } from '../components/social/SocialLeaderboardCard';
import { UserProfileView } from '../components/social/UserProfileView';
import { Search, Loader2 } from 'lucide-react';

// Module-level in-memory cache to prevent flashing "only my account" during page transitions
let cachedUsers: UserData[] = [];
let cachedHasLoaded = false;
let cachedLeaderboards: any = null;

export default function Social() {
    const scrollRef = useRef<HTMLDivElement>(null);
    const { user: currentUser } = useAuth();
    const { userId: routeUserId } = useParams<{ userId?: string }>();
    const navigate = useNavigate();

    // Data states from Firestore (seeded with cache to avoid blank flash on re-visiting)
    const [allUsers, setAllUsers] = useState<UserData[]>(cachedUsers);
    const [leaderboards, setLeaderboards] = useState<any>(cachedLeaderboards);
    const [loadingUsers, setLoadingUsers] = useState<boolean>(!cachedHasLoaded);
    const [loadingLeaderboards, setLoadingLeaderboards] = useState<boolean>(!cachedLeaderboards);

    // Direct single user fetch state (for direct deep links or unauthenticated visits)
    const [directUser, setDirectUser] = useState<UserData | null>(null);
    const [directUserStats, setDirectUserStats] = useState<any>(null);
    const [loadingDirectUser, setLoadingDirectUser] = useState(false);

    // Selected user for profile view
    const [manualSelectedUserUid, setManualSelectedUserUid] = useState<string | null>(null);
    const selectedUserUid = routeUserId !== undefined ? (routeUserId || null) : manualSelectedUserUid;
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch / subscribe to all users in Firestore
    useEffect(() => {
        let isMounted = true;
        const usersRef = collection(db, 'users');

        // Failsafe timeout to prevent infinite spinner on poor/offline connection
        const failsafeTimer = setTimeout(() => {
            if (isMounted) {
                setLoadingUsers(false);
            }
        }, 4000);

        const unsubUsers = onSnapshot(usersRef, (snapshot) => {
            if (!isMounted) return;
            const usersList: UserData[] = [];
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                usersList.push({
                    uid: docSnap.id,
                    shortId: data.shortId,
                    email: data.email || null,
                    emailVerified: data.emailVerified ?? true,
                    username: data.username || 'CubingUser',
                    color: data.color || '#3b82f6',
                    following: data.following || data.starredUsers || [],
                    starredUsers: data.following || data.starredUsers || [],
                    blockedUsers: data.blockedUsers || [],
                    socials: data.socials || [],
                    lastSeenAt: data.lastSeenAt,
                    status: data.status,
                    isGhostMode: data.isGhostMode ?? false,
                    pinnedGoalIds: Array.isArray(data.pinnedGoalIds) ? data.pinnedGoalIds : []
                });
            });
            setAllUsers(usersList);
            cachedUsers = usersList;

            // If the snapshot is from local cache and has <= 1 document (usually just current user's profile from auth),
            // wait for the server snapshot before marking initial loading as complete.
            const isPartialCache = snapshot.metadata.fromCache && usersList.length <= 1;
            if (!isPartialCache) {
                cachedHasLoaded = true;
                setLoadingUsers(false);
            }
        }, async (err) => {
            console.warn("Users subscription warning:", err.message);
            try {
                const snapshot = await getDocs(usersRef);
                if (!isMounted) return;
                const usersList: UserData[] = [];
                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    usersList.push({
                        uid: docSnap.id,
                        shortId: data.shortId,
                        email: data.email || null,
                        emailVerified: data.emailVerified ?? true,
                        username: data.username || 'CubingUser',
                        color: data.color || '#3b82f6',
                        following: data.following || data.starredUsers || [],
                        starredUsers: data.following || data.starredUsers || [],
                        blockedUsers: data.blockedUsers || [],
                        socials: data.socials || [],
                        lastSeenAt: data.lastSeenAt,
                        status: data.status,
                        isGhostMode: data.isGhostMode ?? false,
                        pinnedGoalIds: Array.isArray(data.pinnedGoalIds) ? data.pinnedGoalIds : []
                    });
                });
                setAllUsers(usersList);
                cachedUsers = usersList;
                cachedHasLoaded = true;
            } catch (fallbackErr) {
                console.error("Users fallback read error:", fallbackErr);
            } finally {
                if (isMounted) setLoadingUsers(false);
            }
        });

        return () => {
            isMounted = false;
            clearTimeout(failsafeTimer);
            unsubUsers();
        };
    }, []);

    // Fetch / subscribe to global leaderboards in Firestore
    useEffect(() => {
        let isMounted = true;
        const leaderboardsRef = doc(db, 'global_stats', 'leaderboards');

        const failsafeTimer = setTimeout(() => {
            if (isMounted) {
                setLoadingLeaderboards(false);
            }
        }, 4000);

        const unsubLeaderboards = onSnapshot(leaderboardsRef, (docSnap) => {
            if (!isMounted) return;
            if (docSnap.exists()) {
                const data = docSnap.data();
                setLeaderboards(data);
                cachedLeaderboards = data;
            }
            setLoadingLeaderboards(false);
        }, async (err) => {
            console.warn("Leaderboards subscription warning:", err.message);
            try {
                const docSnap = await getDoc(leaderboardsRef);
                if (!isMounted) return;
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setLeaderboards(data);
                    cachedLeaderboards = data;
                }
            } catch (fallbackErr) {
                console.error("Leaderboards fallback read error:", fallbackErr);
            } finally {
                if (isMounted) setLoadingLeaderboards(false);
            }
        });

        return () => {
            isMounted = false;
            clearTimeout(failsafeTimer);
            unsubLeaderboards();
        };
    }, []);

    // Combined list of users (ensuring current user and direct user are included)

    // Track last scrolled ID to prevent auto-scrolling when simply re-rendering
    const lastScrolledUserId = useRef<string | null>(null);

    // Auto-scroll to top when viewing a profile
    useEffect(() => {
        if (routeUserId && scrollRef.current && lastScrolledUserId.current !== routeUserId) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            lastScrolledUserId.current = routeUserId;
        }
    }, [routeUserId]);

    const combinedUsers = useMemo(() => {
        let base = allUsers;
        if (currentUser && !base.some(u => u.uid === currentUser.uid)) {
            base = [currentUser, ...base];
        }
        if (directUser && !base.some(u => u.uid === directUser.uid)) {
            base = [directUser, ...base];
        }
        return base;
    }, [allUsers, currentUser, directUser]);

    // Direct User Lookup by route param (handles both Auth UID and Short ID directly)
    useEffect(() => {
        if (!routeUserId) {
            setDirectUser(null);
            setDirectUserStats(null);
            setLoadingDirectUser(false);
            return;
        }

        const cleanTarget = routeUserId.replace('#', '').trim();
        const existingInCombined = combinedUsers.find(
            u => u.uid === cleanTarget ||
                 u.shortId?.toLowerCase() === cleanTarget.toLowerCase() ||
                 u.username.toLowerCase() === cleanTarget.toLowerCase()
        );

        let isMounted = true;
        const fetchDirectData = async () => {
            setLoadingDirectUser(true);
            try {
                let targetUserData = existingInCombined;

                // 1. If not in combinedUsers, fetch from Firestore
                if (!targetUserData) {
                    const userDocSnap = await getDoc(doc(db, 'users', cleanTarget));
                    if (userDocSnap.exists()) {
                        const data = userDocSnap.data();
                        targetUserData = {
                            uid: userDocSnap.id,
                            shortId: data.shortId,
                            email: data.email || null,
                            emailVerified: data.emailVerified ?? true,
                            username: data.username || 'CubingUser',
                            color: data.color || '#3b82f6',
                            following: data.following || data.starredUsers || [],
                            starredUsers: data.following || data.starredUsers || [],
                            blockedUsers: data.blockedUsers || [],
                            socials: data.socials || [],
                            lastSeenAt: data.lastSeenAt,
                            status: data.status,
                            isGhostMode: data.isGhostMode ?? false,
                            pinnedGoalIds: Array.isArray(data.pinnedGoalIds) ? data.pinnedGoalIds : []
                        };
                    } else {
                        // 2. Try by shortId
                        const shortIdQuery = query(collection(db, 'users'), where('shortId', '==', cleanTarget));
                        const shortIdSnap = await getDocs(shortIdQuery);
                        if (!shortIdSnap.empty) {
                            const docSnap = shortIdSnap.docs[0];
                            const data = docSnap.data();
                            targetUserData = {
                                uid: docSnap.id,
                                shortId: data.shortId,
                                email: data.email || null,
                                emailVerified: data.emailVerified ?? true,
                                username: data.username || 'CubingUser',
                                color: data.color || '#3b82f6',
                                following: data.following || data.starredUsers || [],
                                starredUsers: data.following || data.starredUsers || [],
                                blockedUsers: data.blockedUsers || [],
                                socials: data.socials || [],
                                lastSeenAt: data.lastSeenAt,
                                status: data.status,
                                isGhostMode: data.isGhostMode ?? false,
                                pinnedGoalIds: Array.isArray(data.pinnedGoalIds) ? data.pinnedGoalIds : []
                            };
                        } else {
                            // 3. Try by username
                            const usernameQuery = query(collection(db, 'users'), where('username', '==', cleanTarget));
                            const usernameSnap = await getDocs(usernameQuery);
                            if (!usernameSnap.empty) {
                                const docSnap = usernameSnap.docs[0];
                                const data = docSnap.data();
                                targetUserData = {
                                    uid: docSnap.id,
                                    shortId: data.shortId,
                                    email: data.email || null,
                                    emailVerified: data.emailVerified ?? true,
                                    username: data.username || 'CubingUser',
                                    color: data.color || '#3b82f6',
                                    following: data.following || data.starredUsers || [],
                                    starredUsers: data.following || data.starredUsers || [],
                                    blockedUsers: data.blockedUsers || [],
                                    socials: data.socials || [],
                                    lastSeenAt: data.lastSeenAt,
                                    status: data.status,
                                    isGhostMode: data.isGhostMode ?? false,
                                    pinnedGoalIds: Array.isArray(data.pinnedGoalIds) ? data.pinnedGoalIds : []
                                };
                            }
                        }
                    }
                }

                if (!isMounted) return;

                if (targetUserData) {
                    setDirectUser(targetUserData);
                    // Fetch user's stats document
                    const statsDocSnap = await getDoc(doc(db, 'users', targetUserData.uid, 'stats', 'overview'));
                    if (isMounted) {
                        if (statsDocSnap.exists()) {
                            setDirectUserStats(statsDocSnap.data());
                        } else {
                            setDirectUserStats(null);
                        }
                    }
                } else {
                    setDirectUser(null);
                    setDirectUserStats(null);
                }
            } catch (err) {
                console.warn("Direct profile fetch warning:", err);
            } finally {
                if (isMounted) setLoadingDirectUser(false);
            }
        };

        fetchDirectData();

        return () => {
            isMounted = false;
        };
    }, [routeUserId, combinedUsers]);

    // Active selected user object
    const selectedUser = useMemo(() => {
        if (!selectedUserUid) return null;
        const cleanTarget = selectedUserUid.replace('#', '').trim().toLowerCase();
        const found = combinedUsers.find(
            u => u.uid === selectedUserUid ||
                 u.shortId?.toLowerCase() === cleanTarget ||
                 u.uid.toLowerCase() === cleanTarget ||
                 u.username.toLowerCase() === cleanTarget
        );
        return found || directUser || null;
    }, [selectedUserUid, combinedUsers, directUser]);

    // Stats to pass into UserProfileView
    const effectiveUserStats = directUserStats;

    // Leaderboard calculations for each timeframe table
    
    const fillEmptySlots = (slots: any[] | undefined, defaultText: string) => {
        if (slots && slots.length > 0) return slots;
        const fallback = [];
        for (let i = 1; i <= 5; i++) {
            fallback.push({
                rank: i,
                entry: null,
                isEmpty: true,
                emptyText: `#${i} ${defaultText}`
            });
        }
        return fallback;
    };

    const solvingDaySlots = fillEmptySlots(leaderboards?.solvingDaySlots, "Spot available — start cubing to claim!");
    const solvingWeekSlots = fillEmptySlots(leaderboards?.solvingWeekSlots, "Spot available — start cubing to claim!");
    const goalsMonthSlots = fillEmptySlots(leaderboards?.goalsMonthSlots, "Spot available — complete goals to claim!");
    const diverseMonthSlots = fillEmptySlots(leaderboards?.diverseMonthSlots, "Spot available — try different puzzles to claim!");
    const luckySlots = fillEmptySlots(leaderboards?.luckySlots, "Spot available — set a new PB single to claim!");
    const improvedSlots = fillEmptySlots(leaderboards?.improvedSlots, "Spot available — break a personal record this month!");

    
    // Tag current user manually since backend calculation doesn't know who is looking at it
    const tagCurrentUser = (slots: any[]) => {
        return slots.map(slot => ({
            ...slot,
            entry: slot.entry ? {
                ...slot.entry,
                isCurrentUser: slot.entry.user?.uid === currentUser?.uid
            } : null
        }));
    };


    // Filter directory cubers - Hide profiles with default placeholder name unless searching or is current user
    const filteredCubers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return combinedUsers.filter(u => {
            const username = (u.username || '').trim();
            if (!q && username.toLowerCase() === 'cubinguser' && u.uid !== currentUser?.uid) {
                return false;
            }

            if (!q) return true;
            const nameMatch = username.toLowerCase().includes(q);
            const idMatch = (u.shortId || '').toLowerCase().includes(q.replace('#', ''));
            return nameMatch || idMatch;
        });
    }, [combinedUsers, searchQuery, currentUser?.uid]);

    const handleSelectUser = (userToSelect: UserData) => {
        const identifier = userToSelect.shortId || userToSelect.uid;
        setManualSelectedUserUid(userToSelect.uid);
        navigate(`/social/${identifier}`);
    };

    const handleBackFromProfile = () => {
        setManualSelectedUserUid(null);
        navigate('/social');
    };

    const isInitialLoading = (loadingUsers || loadingLeaderboards) && (allUsers.length <= 1 || !leaderboards);

    if (isInitialLoading || (routeUserId && loadingDirectUser && !selectedUser)) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3 text-text-secondary">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    <span className="text-xs font-semibold">
                        {routeUserId ? 'Loading cuber profile...' : 'Loading cubing community...'}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div ref={scrollRef} className="flex-1 flex flex-col min-h-0 bg-bg-primary overflow-y-auto custom-scrollbar select-none">
            <div className="max-w-7xl w-full mx-auto px-1.5 py-2.5 sm:px-3 sm:py-3 md:px-4 md:py-4 flex flex-col gap-6 @container">

                {/* USER PROFILE VIEW (When a user card is selected) */}
                {routeUserId && !selectedUser ? (
                    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center animate-in fade-in duration-200">
                        <p className="text-sm text-text-secondary">Cuber profile not found.</p>
                        <button
                            onClick={handleBackFromProfile}
                            className="px-4 py-2 text-xs font-semibold text-text-primary bg-surface-elevation-1 border border-border/80 hover:bg-bg-hover rounded-xl cursor-pointer"
                        >
                            Return to Community Social
                        </button>
                    </div>
                ) : selectedUser ? (
                    <UserProfileView
                        targetUser={selectedUser}
                        userStats={effectiveUserStats}
                        allUsers={combinedUsers}
                        onBack={handleBackFromProfile}
                        onSelectUser={handleSelectUser}
                    />
                ) : (
                    /* MAIN SOCIAL TABLES & DIRECTORY */
                    <div className="flex flex-col gap-10 animate-in fade-in duration-200">

                        {/* 6 LEADERBOARDS GRID (Render 3 to a row if there is room) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 @sm:grid-cols-2 @3xl:grid-cols-3 gap-6 sm:gap-8">
                            {/* 1. Most Solving Today */}
                            <SocialLeaderboardCard
                                title="Most Solving Today"
                                slots={tagCurrentUser(solvingDaySlots)}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 2. Most Solving This Week */}
                            <SocialLeaderboardCard
                                title="Most Solving This Week"
                                slots={tagCurrentUser(solvingWeekSlots)}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 3. Most Goals Past Month */}
                            <SocialLeaderboardCard
                                title="Most Goals Past Month"
                                slots={tagCurrentUser(goalsMonthSlots)}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 4. Most Diverse This Month */}
                            <SocialLeaderboardCard
                                title="Most Diverse This Month"
                                slots={tagCurrentUser(diverseMonthSlots)}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 5. Most Lucky Past Month */}
                            <SocialLeaderboardCard
                                title="Most Lucky Past Month"
                                slots={tagCurrentUser(luckySlots)}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 6. Most Improved This Month */}
                            <SocialLeaderboardCard
                                title="Most Improved This Month"
                                slots={tagCurrentUser(improvedSlots)}
                                onSelectUser={handleSelectUser}
                            />
                        </div>

                        {/* COMMUNITY CUBERS DIRECTORY */}
                        <div className="flex flex-col gap-4 pt-6 border-t border-border/40">
                                <>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                                            Community Profiles ({filteredCubers.length})
                                        </h2>

                                        {/* Search Bar */}
                                        <div className="relative w-full sm:w-64">
                                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                                            <input
                                                type="text"
                                                placeholder="Search by name or #id..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full bg-surface-elevation-1 border border-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
                                            />
                                        </div>
                                    </div>

                                    {/* User Cards Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {filteredCubers.map(userItem => {
                                            const isSelf = currentUser?.uid === userItem.uid;

                                            return (
                                                <div
                                                    key={userItem.uid}
                                                    onClick={() => handleSelectUser(userItem)}
                                                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border bg-surface-elevation-1 hover:bg-bg-hover hover:border-accent/40 transition-all cursor-pointer group shadow-2xs select-none ${
                                                        isSelf ? 'border-accent/40 ring-1 ring-accent/20' : 'border-border/60'
                                                    }`}
                                                >
                                                    {/* Square Avatar */}
                                                    <div
                                                        className="w-8 h-8 rounded-lg shrink-0 shadow-2xs transition-transform group-hover:scale-105"
                                                        style={{ backgroundColor: userItem.color || '#3b82f6' }}
                                                    />

                                                    {/* Name & Short ID */}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                                                            {userItem.username || 'CubingUser'}
                                                        </span>
                                                        <span className="text-[10px] text-text-secondary font-mono truncate">
                                                            #{userItem.shortId || '????'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {filteredCubers.length === 0 && (
                                        <div className="py-8 text-center text-text-secondary text-xs italic bg-surface-elevation-1/40 rounded-xl border border-dashed border-border/40">
                                            No cubers found matching &quot;{searchQuery}&quot;.
                                        </div>
                                    )}
                                </>
                            </div>

                        </div>
                    )}
                </div>
            </div>
    );
}

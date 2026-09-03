import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, getDocs, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserData, Solve } from '../types';
import {
    getMostSolvingLeaderboard,
    getMostGoalsLeaderboard,
    getMostDiverseLeaderboard,
    getMostLuckyLeaderboard,
    getMostImprovedLeaderboard
} from '../utils/socialCalculations';
import { SocialLeaderboardCard } from '../components/social/SocialLeaderboardCard';
import { UserProfileView } from '../components/social/UserProfileView';
import { Search, Loader2 } from 'lucide-react';

export default function Social() {
    const { user: currentUser } = useAuth();
    const { userId: routeUserId } = useParams<{ userId?: string }>();
    const navigate = useNavigate();

    // Data states from Firestore
    const [allUsers, setAllUsers] = useState<UserData[]>([]);
    const [allSolves, setAllSolves] = useState<Solve[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Direct single user fetch state (for direct deep links or unauthenticated visits)
    const [directUser, setDirectUser] = useState<UserData | null>(null);
    const [directSolves, setDirectSolves] = useState<Solve[]>([]);
    const [loadingDirectUser, setLoadingDirectUser] = useState(false);

    // Selected user for profile view
    const [manualSelectedUserUid, setManualSelectedUserUid] = useState<string | null>(null);
    const selectedUserUid = routeUserId !== undefined ? (routeUserId || null) : manualSelectedUserUid;
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch / subscribe to all users in Firestore
    useEffect(() => {
        let isMounted = true;
        const usersRef = collection(db, 'users');
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
            setLoadingData(false);
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
            } catch (fallbackErr) {
                console.error("Users fallback read error:", fallbackErr);
            } finally {
                if (isMounted) setLoadingData(false);
            }
        });

        return () => {
            isMounted = false;
            unsubUsers();
        };
    }, []);

    // Fetch / subscribe to all solves in Firestore
    useEffect(() => {
        let isMounted = true;
        const solvesRef = collection(db, 'solves');
        const unsubSolves = onSnapshot(solvesRef, (snapshot) => {
            if (!isMounted) return;
            const solvesList: Solve[] = [];
            snapshot.docs.forEach(docSnap => {
                const data = docSnap.data();
                solvesList.push({
                    id: docSnap.id,
                    time: data.time,
                    scramble: data.scramble,
                    date: data.date,
                    penalty: data.penalty,
                    inspectionTime: data.inspectionTime,
                    inspectionPenalty: data.inspectionPenalty,
                    sessionId: data.sessionId,
                    userId: data.userId,
                    scrambleType: data.scrambleType || '333',
                    anomalyApproved: data.anomalyApproved
                });
            });
            setAllSolves(solvesList);
        }, async (err) => {
            console.warn("Solves subscription warning:", err.message);
            try {
                const snapshot = await getDocs(solvesRef);
                if (!isMounted) return;
                const solvesList: Solve[] = [];
                snapshot.docs.forEach(docSnap => {
                    const data = docSnap.data();
                    solvesList.push({
                        id: docSnap.id,
                        time: data.time,
                        scramble: data.scramble,
                        date: data.date,
                        penalty: data.penalty,
                        inspectionTime: data.inspectionTime,
                        inspectionPenalty: data.inspectionPenalty,
                        sessionId: data.sessionId,
                        userId: data.userId,
                        scrambleType: data.scrambleType || '333',
                        anomalyApproved: data.anomalyApproved
                    });
                });
                setAllSolves(solvesList);
            } catch (fallbackErr) {
                console.error("Solves fallback read error:", fallbackErr);
            }
        });

        return () => {
            isMounted = false;
            unsubSolves();
        };
    }, []);

    // Combined list of users (ensuring current user and direct user are included)
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
            setDirectSolves([]);
            setLoadingDirectUser(false);
            return;
        }

        const cleanTarget = routeUserId.replace('#', '').trim();
        const existingInCombined = combinedUsers.find(
            u => u.uid === cleanTarget || u.shortId?.toLowerCase() === cleanTarget.toLowerCase()
        );

        if (existingInCombined) {
            setDirectUser(existingInCombined);
            return;
        }

        let isMounted = true;
        const fetchDirectProfile = async () => {
            setLoadingDirectUser(true);
            try {
                // 1. Try finding by Auth UID
                const userDocSnap = await getDoc(doc(db, 'users', cleanTarget));
                if (userDocSnap.exists() && isMounted) {
                    const data = userDocSnap.data();
                    const targetUserData: UserData = {
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
                    setDirectUser(targetUserData);

                    // Fetch solves for this user directly
                    const solvesSnap = await getDocs(query(collection(db, 'solves'), where('userId', '==', targetUserData.uid)));
                    if (isMounted) {
                        const directSolvesList: Solve[] = [];
                        solvesSnap.docs.forEach(docSnap => {
                            const sData = docSnap.data();
                            directSolvesList.push({
                                id: docSnap.id,
                                time: sData.time,
                                scramble: sData.scramble,
                                date: sData.date,
                                penalty: sData.penalty,
                                inspectionTime: sData.inspectionTime,
                                inspectionPenalty: sData.inspectionPenalty,
                                sessionId: sData.sessionId,
                                userId: sData.userId,
                                scrambleType: sData.scrambleType || '333',
                                anomalyApproved: sData.anomalyApproved
                            });
                        });
                        setDirectSolves(directSolvesList);
                    }
                    return;
                }

                // 2. Try finding by shortId
                const shortIdQuery = query(collection(db, 'users'), where('shortId', '==', cleanTarget));
                const shortIdSnap = await getDocs(shortIdQuery);
                if (!shortIdSnap.empty && isMounted) {
                    const docSnap = shortIdSnap.docs[0];
                    const data = docSnap.data();
                    const targetUserData: UserData = {
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
                    setDirectUser(targetUserData);

                    // Fetch solves for this user directly
                    const solvesSnap = await getDocs(query(collection(db, 'solves'), where('userId', '==', targetUserData.uid)));
                    if (isMounted) {
                        const directSolvesList: Solve[] = [];
                        solvesSnap.docs.forEach(dSnap => {
                            const sData = dSnap.data();
                            directSolvesList.push({
                                id: dSnap.id,
                                time: sData.time,
                                scramble: sData.scramble,
                                date: sData.date,
                                penalty: sData.penalty,
                                inspectionTime: sData.inspectionTime,
                                inspectionPenalty: sData.inspectionPenalty,
                                sessionId: sData.sessionId,
                                userId: sData.userId,
                                scrambleType: sData.scrambleType || '333',
                                anomalyApproved: sData.anomalyApproved
                            });
                        });
                        setDirectSolves(directSolvesList);
                    }
                }
            } catch (err) {
                console.warn("Direct profile fetch warning:", err);
            } finally {
                if (isMounted) setLoadingDirectUser(false);
            }
        };

        fetchDirectProfile();

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
                 u.uid.toLowerCase() === cleanTarget
        );
        return found || directUser || null;
    }, [selectedUserUid, combinedUsers, directUser]);

    // Solves to pass into UserProfileView
    const effectiveSolves = useMemo(() => {
        if (allSolves.length > 0) return allSolves;
        return directSolves;
    }, [allSolves, directSolves]);

    // Leaderboard calculations for each timeframe table
    const solvingDaySlots = useMemo(() => {
        return getMostSolvingLeaderboard(combinedUsers, allSolves, 'day', currentUser?.uid);
    }, [combinedUsers, allSolves, currentUser?.uid]);

    const solvingWeekSlots = useMemo(() => {
        return getMostSolvingLeaderboard(combinedUsers, allSolves, 'week', currentUser?.uid);
    }, [combinedUsers, allSolves, currentUser?.uid]);

    const goalsMonthSlots = useMemo(() => {
        return getMostGoalsLeaderboard(combinedUsers, allSolves, 'month', currentUser?.uid);
    }, [combinedUsers, allSolves, currentUser?.uid]);

    const goalsYearSlots = useMemo(() => {
        return getMostGoalsLeaderboard(combinedUsers, allSolves, 'year', currentUser?.uid);
    }, [combinedUsers, allSolves, currentUser?.uid]);

    const diverseWeekSlots = useMemo(() => {
        return getMostDiverseLeaderboard(combinedUsers, allSolves, 'week', currentUser?.uid);
    }, [combinedUsers, allSolves, currentUser?.uid]);

    const diverseMonthSlots = useMemo(() => {
        return getMostDiverseLeaderboard(combinedUsers, allSolves, 'month', currentUser?.uid);
    }, [combinedUsers, allSolves, currentUser?.uid]);

    const luckySlots = useMemo(() => {
        return getMostLuckyLeaderboard(combinedUsers, allSolves, currentUser?.uid);
    }, [combinedUsers, allSolves, currentUser?.uid]);

    const improvedSlots = useMemo(() => {
        return getMostImprovedLeaderboard(combinedUsers, allSolves, currentUser?.uid);
    }, [combinedUsers, allSolves, currentUser?.uid]);

    // Filter directory cubers - Hide profiles with name "CubingUser"
    const filteredCubers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        return combinedUsers.filter(u => {
            const username = (u.username || '').trim();
            if (username.toLowerCase() === 'cubinguser') return false;

            if (!q) return true;
            const nameMatch = username.toLowerCase().includes(q);
            const idMatch = (u.shortId || '').toLowerCase().includes(q.replace('#', ''));
            return nameMatch || idMatch;
        });
    }, [combinedUsers, searchQuery]);

    const handleSelectUser = (userToSelect: UserData) => {
        setManualSelectedUserUid(userToSelect.uid);
        navigate(`/social/${userToSelect.uid}`);
    };

    const handleBackFromProfile = () => {
        setManualSelectedUserUid(null);
        navigate('/social');
    };

    if ((loadingData && combinedUsers.length === 0) || (routeUserId && loadingDirectUser && !selectedUser)) {
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
        <div className="flex-1 flex flex-col min-h-0 bg-bg-primary overflow-y-auto custom-scrollbar select-none">
            <div className="max-w-7xl w-full mx-auto px-2.5 py-4 sm:p-4 md:p-6 flex flex-col gap-8">

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
                        solves={effectiveSolves}
                        allUsers={combinedUsers}
                        onBack={handleBackFromProfile}
                        onSelectUser={handleSelectUser}
                    />
                ) : (
                    /* MAIN SOCIAL TABLES & DIRECTORY */
                    <div className="flex flex-col gap-10 animate-in fade-in duration-200">

                        {/* 8 LEADERBOARDS GRID (No parenthesis in headers) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 sm:gap-8">
                            {/* 1. Most Solving Today */}
                            <SocialLeaderboardCard
                                title="Most Solving Today"
                                slots={solvingDaySlots}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 2. Most Solving This Week */}
                            <SocialLeaderboardCard
                                title="Most Solving This Week"
                                slots={solvingWeekSlots}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 3. Most Goals Past Month */}
                            <SocialLeaderboardCard
                                title="Most Goals Past Month"
                                slots={goalsMonthSlots}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 4. Most Goals Past Year */}
                            <SocialLeaderboardCard
                                title="Most Goals Past Year"
                                slots={goalsYearSlots}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 5. Most Diverse This Week */}
                            <SocialLeaderboardCard
                                title="Most Diverse This Week"
                                slots={diverseWeekSlots}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 6. Most Diverse This Month */}
                            <SocialLeaderboardCard
                                title="Most Diverse This Month"
                                slots={diverseMonthSlots}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 7. Most Lucky Past Month */}
                            <SocialLeaderboardCard
                                title="Most Lucky Past Month"
                                slots={luckySlots}
                                onSelectUser={handleSelectUser}
                            />

                            {/* 8. Most Improved This Week */}
                            <SocialLeaderboardCard
                                title="Most Improved This Week"
                                slots={improvedSlots}
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

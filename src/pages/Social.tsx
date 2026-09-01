import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
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

    // Selected user for profile view
    const [manualSelectedUserUid, setManualSelectedUserUid] = useState<string | null>(null);
    const selectedUserUid = routeUserId !== undefined ? (routeUserId || null) : manualSelectedUserUid;
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch / subscribe to all users in Firestore
    useEffect(() => {
        let isMounted = true;
        let unsubUsers: (() => void) | null = null;

        if (currentUser) {
            const usersRef = collection(db, 'users');
            unsubUsers = onSnapshot(usersRef, (snapshot) => {
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
                        isGhostMode: data.isGhostMode ?? false
                    });
                });
                setAllUsers(usersList);
                setLoadingData(false);
            }, (err) => {
                console.warn("Users subscription warning:", err.message);
                if (isMounted) setLoadingData(false);
            });
        } else {
            // Guest mode: one-time safe read to avoid watch stream assertion errors
            const loadGuestUsers = async () => {
                try {
                    const snapshot = await getDocs(collection(db, 'users'));
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
                            isGhostMode: data.isGhostMode ?? false
                        });
                    });
                    setAllUsers(usersList);
                } catch {
                    // Gracefully handled for guest mode
                } finally {
                    if (isMounted) setLoadingData(false);
                }
            };
            loadGuestUsers();
        }

        return () => {
            isMounted = false;
            if (unsubUsers) unsubUsers();
        };
    }, [currentUser]);

    // Fetch / subscribe to all solves in Firestore
    useEffect(() => {
        let isMounted = true;
        let unsubSolves: (() => void) | null = null;

        if (currentUser) {
            const solvesRef = collection(db, 'solves');
            unsubSolves = onSnapshot(solvesRef, (snapshot) => {
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
            }, (err) => {
                console.warn("Solves subscription warning:", err.message);
            });
        } else {
            const loadGuestSolves = async () => {
                try {
                    const snapshot = await getDocs(collection(db, 'solves'));
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
                } catch {
                    // Gracefully handled for guest mode
                }
            };
            loadGuestSolves();
        }

        return () => {
            isMounted = false;
            if (unsubSolves) unsubSolves();
        };
    }, [currentUser]);

    // Combined list of users (ensuring current user is included even before snapshot)
    const combinedUsers = useMemo(() => {
        if (!currentUser) return allUsers;
        const exists = allUsers.some(u => u.uid === currentUser.uid);
        if (!exists) {
            return [currentUser, ...allUsers];
        }
        return allUsers;
    }, [allUsers, currentUser]);

    // Active selected user object
    const selectedUser = useMemo(() => {
        if (!selectedUserUid) return null;
        return combinedUsers.find(u => u.uid === selectedUserUid) || null;
    }, [selectedUserUid, combinedUsers]);

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

    if (loadingData && combinedUsers.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                <div className="flex flex-col items-center gap-3 text-text-secondary">
                    <Loader2 className="w-6 h-6 animate-spin text-accent" />
                    <span className="text-xs font-semibold">Loading cubing community...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-bg-primary overflow-y-auto custom-scrollbar select-none">
            <div className="max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col gap-8">

                {/* USER PROFILE VIEW (When a user card is selected) */}
                {selectedUser ? (
                    <UserProfileView
                        targetUser={selectedUser}
                        solves={allSolves}
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

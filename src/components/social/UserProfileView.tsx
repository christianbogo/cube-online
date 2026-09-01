import { useState, useEffect, useMemo } from 'react';
import type { UserData, Solve, SocialProfile } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { evaluateUserGoals } from '../../utils/goalsCalculations';
import { isAdmin, eraseUserProfileAndData } from '../../utils/admin';
import RecordTable from '../records/RecordTable';
import {
    ArrowLeft,
    Copy,
    Check,
    Pin,
    Target,
    CheckCircle2,
    Clock,
    Layers,
    Flame,
    Award,
    Trash2,
    AlertTriangle,
    Loader2,
    Share2
} from 'lucide-react';

const NETWORK_LABELS: Record<string, string> = {
    email: 'Email',
    discord: 'Discord',
    'x-twitter': 'X (Twitter)',
    twitter: 'Twitter',
    instagram: 'Instagram',
    youtube: 'YouTube',
    twitch: 'Twitch',
    github: 'GitHub',
    bluesky: 'Bluesky',
    threads: 'Threads',
    reddit: 'Reddit',
    tiktok: 'TikTok',
    spotify: 'Spotify',
    snapchat: 'Snapchat',
    facebook: 'Facebook',
    linkedin: 'LinkedIn',
    telegram: 'Telegram',
    signal: 'Signal',
    whatsapp: 'WhatsApp',
    pinterest: 'Pinterest',
    dribbble: 'Dribbble',
    figma: 'Figma',
    messenger: 'Messenger',
    tumblr: 'Tumblr',
    vk: 'VK',
    other: 'Other'
};

export interface UserProfileViewProps {
    targetUser: UserData;
    solves: Solve[];
    allUsers: UserData[];
    onBack: () => void;
    onSelectUser: (user: UserData) => void;
}

export function UserProfileView({
    targetUser: initialUser,
    solves,
    allUsers,
    onBack,
    onSelectUser
}: UserProfileViewProps) {
    const { user: currentUser, toggleFollowUser, toggleBlockUser } = useAuth();
    const [liveUser, setLiveUser] = useState<UserData>(initialUser);
    const [pinnedGoalIds, setPinnedGoalIds] = useState<string[]>([]);
    const [copiedId, setCopiedId] = useState(false);
    const [copiedSocialId, setCopiedSocialId] = useState<string | null>(null);
    const [copiedShareLink, setCopiedShareLink] = useState(false);
    const [followLoading, setFollowLoading] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);

    // Dynamic Page Title & Meta Tags for browser tabs and sharing
    useEffect(() => {
        const username = liveUser.username || 'CubingUser';
        const cleanCode = liveUser.shortId ? liveUser.shortId.replace('#', '').trim() : '';
        // Formatted strictly as "[name]#[code]" without adding Cube Online
        const pageTitle = cleanCode ? `${username}#${cleanCode}` : username;
        const previousTitle = document.title;

        document.title = pageTitle;

        // Update meta tags dynamically in DOM
        const updateMeta = (selector: string, attr: string, value: string) => {
            let el = document.querySelector(selector);
            if (!el) {
                el = document.createElement('meta');
                const [attrName] = selector.replace(/[\[\]"']/g, '').split('=');
                el.setAttribute(attrName, selector.split('=')[1]?.replace(/["']/g, '') || '');
                document.head.appendChild(el);
            }
            el.setAttribute(attr, value);
        };

        const ogImageUrl = `${window.location.origin}/api/og?name=${encodeURIComponent(username)}&color=${encodeURIComponent(liveUser.color || '#3b82f6')}&code=${encodeURIComponent(cleanCode)}`;

        updateMeta('meta[property="og:title"]', 'content', pageTitle);
        updateMeta('meta[property="og:image"]', 'content', ogImageUrl);
        updateMeta('meta[name="twitter:title"]', 'content', pageTitle);
        updateMeta('meta[name="twitter:image"]', 'content', ogImageUrl);

        return () => {
            document.title = previousTitle || 'Cube Online';
            updateMeta('meta[property="og:title"]', 'content', 'Cube Online');
            updateMeta('meta[property="og:image"]', 'content', `${window.location.origin}/og-image.png`);
            updateMeta('meta[name="twitter:title"]', 'content', 'Cube Online');
            updateMeta('meta[name="twitter:image"]', 'content', `${window.location.origin}/og-image.png`);
        };
    }, [liveUser.username, liveUser.shortId, liveUser.color]);

    const handleShareProfile = async () => {
        const shareCode = liveUser.shortId || liveUser.uid;
        const username = liveUser.username || 'CubingUser';
        const cleanCode = liveUser.shortId ? liveUser.shortId.replace('#', '').trim() : '';
        const title = cleanCode ? `${username}#${cleanCode}` : username;
        const shareUrl = `${window.location.origin}/social/${shareCode}`;
        const shareData = {
            title,
            text: `Check out ${username}'s speedcubing records and profile on Cube Online!`,
            url: shareUrl
        };

        if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.warn("Navigator share warning:", err);
                }
            }
        }

        // Fallback to clipboard
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopiedShareLink(true);
            setTimeout(() => setCopiedShareLink(false), 2000);
        } catch {
            prompt('Copy profile link:', shareUrl);
        }
    };

    // Admin Erase Profile Dual Confirmation States
    const [isEraseModalOpen, setIsEraseModalOpen] = useState(false);
    const [eraseStep, setEraseStep] = useState<1 | 2>(1);
    const [isErasing, setIsErasing] = useState(false);
    const [confirmationInput, setConfirmationInput] = useState('');

    const handleStartErase = () => {
        setEraseStep(1);
        setConfirmationInput('');
        setIsEraseModalOpen(true);
    };

    const handleCloseErase = () => {
        if (isErasing) return;
        setIsEraseModalOpen(false);
        setEraseStep(1);
        setConfirmationInput('');
    };

    const handleExecuteErase = async () => {
        setIsErasing(true);
        try {
            await eraseUserProfileAndData(liveUser.uid);
            setIsEraseModalOpen(false);
            onBack();
        } catch (e) {
            console.error("Error erasing user:", e);
            setIsErasing(false);
        }
    };

    // Sync live user profile from Firestore
    useEffect(() => {
        setLiveUser(initialUser);
        let isMounted = true;
        const userDocRef = doc(db, 'users', initialUser.uid);
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists() && isMounted) {
                const data = docSnap.data();
                setLiveUser({
                    uid: initialUser.uid,
                    shortId: data.shortId || initialUser.shortId,
                    email: data.email || initialUser.email,
                    emailVerified: data.emailVerified ?? true,
                    username: data.username || initialUser.username || 'CubingUser',
                    color: data.color || initialUser.color || '#3b82f6',
                    following: data.following || data.starredUsers || [],
                    starredUsers: data.following || data.starredUsers || [],
                    blockedUsers: data.blockedUsers || [],
                    socials: data.socials || [],
                    lastSeenAt: data.lastSeenAt,
                    status: data.status,
                    isGhostMode: data.isGhostMode ?? false
                });
            }
        }, async (err) => {
            console.warn("User live sync warning:", err.message);
            try {
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists() && isMounted) {
                    const data = docSnap.data();
                    setLiveUser({
                        uid: initialUser.uid,
                        shortId: data.shortId || initialUser.shortId,
                        email: data.email || initialUser.email,
                        emailVerified: data.emailVerified ?? true,
                        username: data.username || initialUser.username || 'CubingUser',
                        color: data.color || initialUser.color || '#3b82f6',
                        following: data.following || data.starredUsers || [],
                        starredUsers: data.following || data.starredUsers || [],
                        blockedUsers: data.blockedUsers || [],
                        socials: data.socials || [],
                        lastSeenAt: data.lastSeenAt,
                        status: data.status,
                        isGhostMode: data.isGhostMode ?? false
                    });
                }
            } catch {
                // Ignore permissions error
            }
        });
        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, [initialUser.uid, initialUser]);

    // Fetch user pinned goals from users/{uid}/goals/progress
    useEffect(() => {
        let isMounted = true;
        const goalsDocRef = doc(db, 'users', initialUser.uid, 'goals', 'progress');

        const unsub = onSnapshot(goalsDocRef, (snap) => {
            if (snap.exists() && isMounted) {
                const data = snap.data();
                if (Array.isArray(data.pinnedGoalIds)) {
                    setPinnedGoalIds(data.pinnedGoalIds);
                }
            }
        }, async () => {
            try {
                const gSnap = await getDoc(goalsDocRef);
                if (gSnap.exists() && isMounted) {
                    const data = gSnap.data();
                    if (Array.isArray(data.pinnedGoalIds)) {
                        setPinnedGoalIds(data.pinnedGoalIds);
                    }
                }
            } catch {
                // Ignore permissions error
            }
        });

        return () => {
            isMounted = false;
            unsub();
        };
    }, [initialUser.uid]);

    // Filter solves for this specific user
    const userSolves = useMemo(() => {
        return solves.filter(s => s.userId === liveUser.uid);
    }, [solves, liveUser.uid]);

    // Compute goals progress for this user
    const allGoalsProgress = useMemo(() => {
        return evaluateUserGoals(userSolves, liveUser);
    }, [userSolves, liveUser]);

    // Pinned goals or fallback top goals
    const displayedPinnedGoals = useMemo(() => {
        if (pinnedGoalIds.length > 0) {
            const matches = pinnedGoalIds
                .map(id => allGoalsProgress.find(g => g.goalId === id))
                .filter((g): g is NonNullable<typeof g> => g !== undefined);
            if (matches.length > 0) return matches;
        }

        // If no pinned goals set, pick top in-progress or recently completed goals
        const inProgress = allGoalsProgress.filter(g => !g.completed && g.percentCompleted > 0);
        const completed = allGoalsProgress.filter(g => g.completed);
        const fallback = [...inProgress, ...completed].slice(0, 3);
        return fallback;
    }, [pinnedGoalIds, allGoalsProgress]);

    // Follow status calculations
    const isSelf = currentUser?.uid === liveUser.uid;
    const currentFollowingList = currentUser?.following || currentUser?.starredUsers || [];
    const isFollowing = currentFollowingList.includes(liveUser.uid);
    const isFollower = (liveUser.following || liveUser.starredUsers || []).includes(currentUser?.uid || '');

    const handleFollowToggle = async () => {
        if (!currentUser || isSelf) return;
        setFollowLoading(true);
        try {
            await toggleFollowUser(liveUser.uid);
        } catch (e) {
            console.error("Error toggling follow:", e);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleBlockToggle = async () => {
        if (!currentUser || isSelf) return;
        setBlockLoading(true);
        try {
            await toggleBlockUser(liveUser.uid);
        } catch (e) {
            console.error("Error toggling block:", e);
        } finally {
            setBlockLoading(false);
        }
    };

    // Online presence check
    const isOnline = useMemo(() => {
        if (!liveUser.lastSeenAt) return false;
        const diffMs = Date.now() - new Date(liveUser.lastSeenAt).getTime();
        return diffMs <= 5 * 60 * 1000;
    }, [liveUser.lastSeenAt]);

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

    // Filter Socials based on Privacy & Mutual Follow
    const visibleSocials = useMemo(() => {
        const rawList: SocialProfile[] = liveUser.socials || [];
        const isMutual = isFollowing && isFollower;
        return rawList.filter(social => {
            if (isSelf) return true;
            if (social.privacy === 'public') return true;
            if (social.privacy === 'friends' && isMutual) return true;
            return false;
        });
    }, [liveUser.socials, isSelf, isFollowing, isFollower]);

    // Following list for target user
    const userFollowing = useMemo(() => {
        const followingIds = new Set(liveUser.following || liveUser.starredUsers || []);
        return allUsers.filter(u => followingIds.has(u.uid) && (u.username || '').toLowerCase() !== 'cubinguser');
    }, [liveUser.following, liveUser.starredUsers, allUsers]);

    // Followers list for target user
    const userFollowers = useMemo(() => {
        return allUsers.filter(u => {
            if ((u.username || '').toLowerCase() === 'cubinguser') return false;
            const theirFollowing = u.following || u.starredUsers || [];
            return theirFollowing.includes(liveUser.uid);
        });
    }, [allUsers, liveUser.uid]);

    const copyShortId = () => {
        if (liveUser.shortId) {
            navigator.clipboard.writeText(liveUser.shortId);
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        }
    };

    const copySocialValue = (id: string, val: string) => {
        navigator.clipboard.writeText(val);
        setCopiedSocialId(id);
        setTimeout(() => setCopiedSocialId(null), 2000);
    };

    const getCategoryIcon = (cat: string) => {
        switch (cat) {
            case 'time': return <Clock className="w-3.5 h-3.5" />;
            case 'count': return <Layers className="w-3.5 h-3.5" />;
            case 'streak': return <Flame className="w-3.5 h-3.5" />;
            case 'diversity': return <Award className="w-3.5 h-3.5" />;
            default: return <Target className="w-3.5 h-3.5" />;
        }
    };

    return (
        <div className="flex flex-col gap-8 sm:gap-10 animate-in fade-in duration-200">
            {/* Top Navigation Back Button */}
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary px-2.5 py-1.5 rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Social</span>
                </button>
            </div>

            {/* MAIN ID HEADER CARD */}
            <div className="bg-surface-elevation-1 border border-border/70 rounded-2xl p-5 sm:p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-md flex items-center justify-center transition-transform hover:scale-105"
                            style={{ backgroundColor: liveUser.color || '#3b82f6' }}
                        />
                        {isOnline && (
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-green-500 border-2 border-surface-elevation-1 rounded-full shadow-xs" />
                        )}
                    </div>

                    {/* Info & All Inline Chips */}
                    <div className="flex-1 text-center sm:text-left min-w-0 flex flex-col gap-2.5">
                        <div className="flex items-center gap-3 justify-center sm:justify-start flex-wrap">
                            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary truncate">
                                {liveUser.username || 'CubingUser'}
                            </h2>

                            {/* Online / Last Seen Indicator */}
                            {isOnline ? (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 border border-green-500/30 flex items-center gap-1.5 shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.7)]" />
                                    Online
                                </span>
                            ) : (
                                <span className="text-xs text-text-secondary bg-bg-secondary px-2 py-0.5 rounded-full border border-border/50">
                                    Last online {getRelativeLastSeen(liveUser.lastSeenAt)}
                                </span>
                            )}
                        </div>

                        {/* INLINE CHIPS: Profile Code, Follow Status, Follows You, and Social Profiles */}
                        <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap pt-0.5">
                            {/* Profile Code Chip */}
                            {liveUser.shortId && (
                                <div
                                    onClick={copyShortId}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-secondary/60 border border-border/40 text-xs text-text-secondary font-mono cursor-pointer hover:text-text-primary hover:border-border transition-colors group"
                                    title="Click to copy ID"
                                >
                                    <span>#{liveUser.shortId}</span>
                                    {copiedId ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                    ) : (
                                        <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                                    )}
                                    {copiedId && <span className="text-[10px] text-green-500 font-sans font-bold">Copied!</span>}
                                </div>
                            )}

                            {/* Share Profile Chip */}
                            <button
                                type="button"
                                onClick={handleShareProfile}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-secondary/60 border border-border/40 text-xs text-text-secondary font-mono cursor-pointer hover:text-accent hover:border-accent/40 transition-colors group"
                                title="Share Profile Link"
                            >
                                <Share2 className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                                <span>{copiedShareLink ? 'Link Copied!' : 'Share'}</span>
                                {copiedShareLink && <Check className="w-3 h-3 text-green-500" />}
                            </button>

                            {/* Follow / Following Button Chip */}
                            {!isSelf && currentUser && (
                                isFollowing ? (
                                    <button
                                        onClick={handleFollowToggle}
                                        disabled={followLoading}
                                        className="group/btn inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-secondary/60 border border-border/40 text-xs text-text-secondary font-mono hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-60"
                                        title="Unfollow"
                                    >
                                        {followLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                        <span className="group-hover/btn:hidden">Following</span>
                                        <span className="hidden group-hover/btn:inline">Unfollow</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleFollowToggle}
                                        disabled={followLoading}
                                        className="group/btn inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-secondary/60 border border-border/40 text-xs text-text-secondary font-mono hover:text-green-500 hover:border-green-500/40 hover:bg-green-500/10 transition-colors cursor-pointer disabled:opacity-60"
                                        title="Follow"
                                    >
                                        {followLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                        <span>{isFollower ? 'Follow Back' : 'Follow'}</span>
                                    </button>
                                )
                            )}

                            {/* Follows You Chip (Hover turns red and says Block) */}
                            {isFollower && !isSelf && (
                                <button
                                    onClick={handleBlockToggle}
                                    disabled={blockLoading}
                                    className="group/btn inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-secondary/60 border border-border/40 text-xs text-text-secondary font-mono hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-60"
                                    title="Block user"
                                >
                                    {blockLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                                    <span className="group-hover/btn:hidden">Follows You</span>
                                    <span className="hidden group-hover/btn:inline">Block</span>
                                </button>
                            )}

                            {/* Social Media Profile Chips (Unbolded Label) */}
                            {visibleSocials.map(social => {
                                const label = NETWORK_LABELS[social.network] || social.network;
                                const isCopied = copiedSocialId === social.id;

                                return (
                                    <div
                                        key={social.id}
                                        onClick={() => copySocialValue(social.id, social.value)}
                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-bg-secondary/60 border border-border/40 text-xs text-text-secondary font-mono hover:text-text-primary hover:border-accent/40 transition-colors cursor-pointer group"
                                        title={`Click to copy ${label}`}
                                    >
                                        <span>{label}:</span>
                                        <span className="truncate max-w-[140px]">{social.value}</span>
                                        {isCopied ? (
                                            <Check className="w-3 h-3 text-green-500 shrink-0" />
                                        ) : (
                                            <Copy className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* 1. PERSONAL RECORDS TABLE (Without footnote & table key on social page) */}
            <div className="flex flex-col gap-2">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider px-1">
                    Personal Records
                </h3>
                <RecordTable solves={userSolves} userId={liveUser.uid} hideFootnote={true} />
            </div>

            {/* 2. PINNED GOALS & PROGRESS */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                        <Pin className="w-3.5 h-3.5 text-accent" />
                        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                            Pinned Goals &amp; Progress
                        </h3>
                    </div>
                    <span className="text-xs text-text-secondary font-mono">
                        {allGoalsProgress.filter(g => g.completed).length} / {allGoalsProgress.length} Unlocked
                    </span>
                </div>

                {displayedPinnedGoals.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {displayedPinnedGoals.map(goal => (
                            <div
                                key={goal.goalId}
                                className="bg-surface-elevation-1 border border-border/60 rounded-xl p-3.5 flex flex-col justify-between gap-2.5 shadow-2xs"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            {goal.completed ? (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                            ) : (
                                                <span className="text-accent shrink-0">{getCategoryIcon(goal.category)}</span>
                                            )}
                                            <span className="font-bold text-xs text-text-primary truncate">
                                                {goal.title}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                                            {goal.description}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] font-mono font-bold shrink-0 ${goal.completed ? 'text-green-500' : 'text-text-secondary'}`}>
                                        {goal.completed ? 'Complete' : `${goal.percentCompleted}%`}
                                    </span>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary mb-1">
                                        <span>{goal.displayCurrent}</span>
                                        <span>{goal.displayTarget}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-bg-primary rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-300 rounded-full ${goal.completed ? 'bg-green-500' : 'bg-accent'}`}
                                            style={{ width: `${goal.percentCompleted}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-4 text-center text-text-secondary/60 text-xs italic bg-surface-elevation-1/50 rounded-xl border border-dashed border-border/40">
                        No goals pinned yet.
                    </div>
                )}
            </div>

            {/* 3. PROFILES THEY FOLLOW & PROFILES THEY ARE FOLLOWED BY */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Following */}
                <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider px-1">
                        Following ({userFollowing.length})
                    </h3>

                    {userFollowing.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {userFollowing.map(u => (
                                <div
                                    key={u.uid}
                                    onClick={() => onSelectUser(u)}
                                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/60 bg-surface-elevation-1 hover:bg-bg-hover hover:border-accent/40 transition-all cursor-pointer group shadow-2xs select-none"
                                >
                                    <div
                                        className="w-7 h-7 rounded-lg shrink-0 shadow-2xs transition-transform group-hover:scale-105"
                                        style={{ backgroundColor: u.color || '#3b82f6' }}
                                    />
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                                            {u.username || 'CubingUser'}
                                        </span>
                                        <span className="text-[10px] text-text-secondary font-mono truncate">
                                            #{u.shortId || '????'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-6 text-center text-text-secondary/60 text-xs italic bg-surface-elevation-1/40 rounded-xl border border-dashed border-border/40">
                            Not following anyone yet.
                        </div>
                    )}
                </div>

                {/* Followers */}
                <div className="flex flex-col gap-3">
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider px-1">
                        Followers ({userFollowers.length})
                    </h3>

                    {userFollowers.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {userFollowers.map(u => (
                                <div
                                    key={u.uid}
                                    onClick={() => onSelectUser(u)}
                                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/60 bg-surface-elevation-1 hover:bg-bg-hover hover:border-accent/40 transition-all cursor-pointer group shadow-2xs select-none"
                                >
                                    <div
                                        className="w-7 h-7 rounded-lg shrink-0 shadow-2xs transition-transform group-hover:scale-105"
                                        style={{ backgroundColor: u.color || '#3b82f6' }}
                                    />
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                                            {u.username || 'CubingUser'}
                                        </span>
                                        <span className="text-[10px] text-text-secondary font-mono truncate">
                                            #{u.shortId || '????'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-6 text-center text-text-secondary/60 text-xs italic bg-surface-elevation-1/40 rounded-xl border border-dashed border-border/40">
                            No followers yet.
                        </div>
                    )}
                </div>
            </div>

            {/* ADMIN ONLY: ERASE PROFILE BUTTON */}
            {isAdmin(currentUser) && (
                <div className="pt-10 pb-4 border-t border-border/40 flex flex-col items-center justify-center gap-2">
                    <button
                        type="button"
                        onClick={handleStartErase}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-red-500 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/50 transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Erase Profile</span>
                    </button>
                    <span className="text-[11px] text-text-secondary/60 font-mono">
                        Admin action: permanently erase profile &amp; all associated data
                    </span>
                </div>
            )}

            {/* DUAL CONFIRMATION POPUP MODAL */}
            {isEraseModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                    onClick={handleCloseErase}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white border border-red-200 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-5 text-gray-900"
                    >
                        {eraseStep === 1 ? (
                            /* STEP 1: FIRST CONFIRMATION */
                            <div className="flex flex-col gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto shadow-xs">
                                    <Trash2 className="w-6 h-6" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-base font-bold text-gray-900">
                                        Erase Profile &amp; Data?
                                    </h3>
                                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                                        Are you sure you want to permanently erase the account for{' '}
                                        <strong className="text-gray-900">@{liveUser.username}</strong> (#{liveUser.shortId})?
                                    </p>
                                    <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mt-3 text-left leading-normal">
                                        This will permanently delete all solves, sessions, goals, personal records, and user documents from the database.
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={handleCloseErase}
                                        className="px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 rounded-xl border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEraseStep(2)}
                                        className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                                    >
                                        Continue to Final Confirmation
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* STEP 2: SECOND / DUAL CONFIRMATION */
                            <div className="flex flex-col gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-300 text-red-600 flex items-center justify-center mx-auto shadow-xs animate-pulse">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-base font-bold text-red-600">
                                        Final Confirmation Required
                                    </h3>
                                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                                        This action is <strong className="text-gray-900">completely irreversible</strong>.
                                    </p>
                                    <p className="text-xs text-gray-800 font-medium mt-3">
                                        Type <code className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 text-red-600 font-mono font-bold">{liveUser.username}</code> to confirm:
                                    </p>
                                </div>

                                <input
                                    type="text"
                                    value={confirmationInput}
                                    onChange={(e) => setConfirmationInput(e.target.value)}
                                    placeholder={liveUser.username}
                                    autoFocus
                                    disabled={isErasing}
                                    className="w-full bg-gray-50 border border-gray-300 focus:border-red-500 rounded-xl px-3.5 py-2 text-xs text-gray-900 font-mono text-center focus:outline-none"
                                />

                                <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setEraseStep(1)}
                                        disabled={isErasing}
                                        className="px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 rounded-xl border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        Go Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExecuteErase}
                                        disabled={isErasing || confirmationInput.trim().toLowerCase() !== (liveUser.username || '').trim().toLowerCase()}
                                        className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-2"
                                    >
                                        {isErasing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                        <span>{isErasing ? 'Erasing Everything...' : 'Permanently Erase Profile'}</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

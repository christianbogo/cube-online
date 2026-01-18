import { useState, useEffect } from 'react';
import { TriangleAlert, Star, Ban, Users, Copy, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function CubingFriendsTab() {
    const { user, toggleStarUser, toggleBlockUser } = useAuth();

    // State
    const [searchCode, setSearchCode] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    // Lists
    const [friends, setFriends] = useState<any[]>([]); // Mutual
    const [following, setFollowing] = useState<any[]>([]); // I star them
    const [followers, setFollowers] = useState<any[]>([]); // They star me
    const [blocked, setBlocked] = useState<any[]>([]);

    const [copiedId, setCopiedId] = useState(false);

    // Fetch Lists
    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            // 1. Fetch Following (My Starred Users)
            const starredIds = user.starredUsers || [];
            let myFollowing: any[] = [];
            if (starredIds.length > 0) {
                const snaps = await Promise.all(starredIds.map((uid: string) => getDoc(doc(db, 'users', uid))));
                myFollowing = snaps.filter(s => s.exists()).map(s => s.data());
            }

            // 2. Fetch Blocked
            const blockedIds = user.blockedUsers || [];
            let myBlocked: any[] = [];
            if (blockedIds.length > 0) {
                const snaps = await Promise.all(blockedIds.map((uid: string) => getDoc(doc(db, 'users', uid))));
                myBlocked = snaps.filter(s => s.exists()).map(s => s.data());
            }

            // 3. Fetch Followers (Users who star ME)
            // Query users where 'starredUsers' array-contains my UID
            // Note: Requires index potentially.
            try {
                const q = query(collection(db, 'users'), where('starredUsers', 'array-contains', user.uid));
                const followerSnaps = await getDocs(q);
                const myFollowers = followerSnaps.docs.map(d => d.data());

                // 4. Calculate Friends (Mutual)
                const friendsList = myFollowing.filter(f => myFollowers.find((follower: any) => follower.uid === f.uid));
                const followingOnly = myFollowing.filter(f => !friendsList.find((friend: any) => friend.uid === f.uid));

                setFriends(friendsList);
                setFollowing(followingOnly);
                setFollowers(myFollowers); // We might want to filter out friends from here too? 
                // "Friends, Following, Followers". Usually Friends are a subset of Following.
                // Let's keep Followers as "People who follow me" (inc friends) or distinct?
                // Request says "List of Friends, Following, Followers". 
                // Let's display clean lists. 

            } catch (e) {
                console.error("Error fetching relationships", e);
            }

            setBlocked(myBlocked);
        };

        fetchData();
    }, [user?.starredUsers, user?.blockedUsers, user?.uid]);

    const handleSearch = async () => {
        if (!searchCode.trim()) return;
        setIsSearching(true);
        try {
            const q = query(collection(db, 'users'), where('shortId', '==', searchCode.trim()));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const found = snap.docs.map(d => d.data());
                // Filter out self
                const others = found.filter(u => u.uid !== user?.uid);
                setSearchResults(others);
            } else {
                setSearchResults([]);
            }
        } catch (e) {
            console.error(e);
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

    const UserCard = ({ targetUser, type }: { targetUser: any, type: 'friend' | 'following' | 'follower' | 'blocked' | 'search' }) => {
        const isStarred = user?.starredUsers?.includes(targetUser.uid);
        const isBlocked = user?.blockedUsers?.includes(targetUser.uid);

        return (
            <div className="flex items-center justify-between p-3 bg-surface-elevation-1 rounded-lg border border-border group hover:border-accent/50 transition-colors">
                <div className="flex items-center gap-3">
                    {/* Profile Pic - Rounded Square */}
                    <div className="w-10 h-10 rounded-lg shadow-sm" style={{ backgroundColor: targetUser.color || '#3b82f6' }} />

                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-text-primary">{targetUser.username}</span>
                        {/* Short ID with Copy */}
                        <div className="flex items-center gap-1 text-xs text-text-secondary group/code cursor-pointer"
                            onClick={() => navigator.clipboard.writeText(targetUser.shortId || '')}
                            title="Click to copy ID"
                        >
                            <span>#{targetUser.shortId || '????'}</span>
                            <Copy className="w-3 h-3 opacity-0 group-hover/code:opacity-100 transition-opacity" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Actions based on relation */}
                    {type !== 'blocked' && (
                        <button
                            onClick={() => toggleStarUser(targetUser.uid)}
                            className={`p-2 rounded-md transition-colors ${isStarred ? 'text-yellow-500 bg-yellow-500/10 hover:bg-yellow-500/20' : 'text-text-secondary hover:bg-bg-tertiary'}`}
                            title={isStarred ? "Unfollow" : "Follow"}
                        >
                            <Star className={`w-4 h-4 ${isStarred ? 'fill-current' : ''}`} />
                        </button>
                    )}

                    <button
                        onClick={() => toggleBlockUser(targetUser.uid)}
                        className={`p-2 rounded-md transition-colors ${isBlocked ? 'text-red-500 bg-red-500/10' : 'text-text-secondary hover:text-red-500 hover:bg-bg-tertiary'}`}
                        title={isBlocked ? "Unblock" : "Block"}
                    >
                        <Ban className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-6 p-2">
            {/* My ID Section */}
            <div className="flex items-center justify-between p-4 bg-accent/10 rounded-lg border border-accent/20">
                <div className="flex flex-col">
                    <span className="text-xs text-accent font-bold uppercase tracking-wider">My Friend Code</span>
                    <div className="flex items-center gap-2 mt-1 cursor-pointer" onClick={copyMyCode}>
                        <span className="text-lg font-mono font-bold text-text-primary">#{user?.shortId || 'Pending...'}</span>
                        <Copy className={`w-4 h-4 ${copiedId ? 'text-green-500' : 'text-text-primary'}`} />
                    </div>
                </div>
                {copiedId && <span className="text-xs text-green-500 font-medium animate-in fade-in">Copied!</span>}
            </div>

            {/* Search */}
            <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-text-secondary uppercase">Find User</label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                        <input
                            type="text"
                            placeholder="Enter 6-character code..."
                            value={searchCode}
                            onChange={(e) => setSearchCode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                            maxLength={6}
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        className="px-4 py-2 bg-text-primary text-bg-primary font-bold rounded-lg text-sm hover:opacity-90 transition-opacity"
                        disabled={isSearching}
                    >
                        Search
                    </button>
                </div>

                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                        {searchResults.map(u => (
                            <UserCard key={u.uid} targetUser={u} type="search" />
                        ))}
                    </div>
                )}
                {isSearching && <p className="text-xs text-text-secondary italic">Searching...</p>}
            </div>

            <hr className="border-border/50" />

            {/* Friends (Mutual) */}
            <div className="flex flex-col gap-3">
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Users className="w-4 h-4 text-green-500" /> Friends ({friends.length})
                </h4>
                {friends.length === 0 && <p className="text-xs text-text-secondary italic opacity-50">No mutual friends yet.</p>}
                {friends.map(u => <UserCard key={u.uid} targetUser={u} type="friend" />)}
            </div>

            {/* Following */}
            <div className="flex flex-col gap-3">
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" /> Following ({following.length})
                </h4>
                {following.length === 0 && <p className="text-xs text-text-secondary italic opacity-50">Not following anyone.</p>}
                {following.map(u => <UserCard key={u.uid} targetUser={u} type="following" />)}
            </div>

            {/* Followers (Only those not already friends?) User asked for list. */}
            <div className="flex flex-col gap-3">
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Users className="w-4 h-4 text-text-secondary" /> Followers ({followers.length})
                </h4>
                {followers.length === 0 && <p className="text-xs text-text-secondary italic opacity-50">No followers yet.</p>}
                {followers.map(u => <UserCard key={u.uid} targetUser={u} type="follower" />)}
            </div>

            {/* Blocked */}
            <div className="flex flex-col gap-3">
                <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                    <Ban className="w-4 h-4 text-red-500" /> Blocked ({blocked.length})
                </h4>
                {blocked.length === 0 && <p className="text-xs text-text-secondary italic opacity-50">No blocked users.</p>}
                {blocked.map(u => <UserCard key={u.uid} targetUser={u} type="blocked" />)}
            </div>

        </div>
    );
}

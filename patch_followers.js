const fs = require('fs');
const file = 'src/components/account/CubingFriendsTab.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('const onlineFollowers')) {
    content = content.replace(
        'const [isFollowersOpen, setIsFollowersOpen] = useState(false);',
        'const [isFollowersOpen, setIsFollowersOpen] = useState(false);\n    const onlineFollowing = useMemo(() => followingList.filter(isUserOnline), [followingList]);\n    const displayedFollowing = isFollowingOpen ? followingList : onlineFollowing;\n    const onlineFollowers = useMemo(() => followersList.filter(isUserOnline), [followersList]);\n    const displayedFollowers = isFollowersOpen ? followersList : onlineFollowers;'
    );
}

if (!content.includes('Followers Section')) {
    const followersJSX = `
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {displayedFollowers.map(u => (
                                <UserConnectionCard key={u.uid} targetUser={u} />
                            ))}
                        </div>
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
`;
    content = content.replace('{/* Blocked Users Section */}', followersJSX + '\n            {/* Blocked Users Section */}');
}

fs.writeFileSync(file, content);

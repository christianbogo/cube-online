import { Link } from 'react-router-dom';

export default function Info() {
    return (
        <div className="max-w-3xl w-full mx-auto px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 select-text font-sans text-text-primary">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                    Documentation &amp; Features
                </h1>
                <p className="text-xs text-text-secondary">
                    Version 0.4.1 &bull; Cube Online Reference Manual
                </p>
                <p className="text-sm text-text-secondary mt-3 leading-relaxed">
                    Cube Online (<a href="https://cubeonline.org" className="underline text-accent">cubeonline.org</a>) is an open speedcubing platform providing precise timing, analytics, goal milestones, and live multiplayer practice. This guide explains the core features across every section of the application and how to use them.
                </p>
            </div>

            <div className="space-y-8 text-sm leading-relaxed text-text-secondary">
                {/* 1. Timer Settings */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        1. Timer Settings
                    </h2>
                    <p>
                        Accessed via the <strong>Timer Settings</strong> button in the center of the top bar. Customizes scramble visibility, timing behavior, typography scaling, and custom events:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Hide Scramble:</strong> Toggles visibility of the scramble algorithm on the main timer screen for blind practice or distraction-free solving.
                        </li>
                        <li>
                            <strong className="text-text-primary">Pass Scramble:</strong> Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">P</kbd> or use the pass button to skip the current scramble and generate the next one without logging a time.
                        </li>
                        <li>
                            <strong className="text-text-primary">Follower Display Modes:</strong> Controls how live multiplayer participants are arranged:
                            <ul className="list-circle pl-5 mt-1 space-y-1 text-xs">
                                <li><strong>Default:</strong> Displays followed cubers as open cards or chips at the top, with unfollowed active community chips at the bottom.</li>
                                <li><strong>Minimal:</strong> Retains followed cuber cards at the top and hides bottom community chips.</li>
                                <li><strong>Popular:</strong> Only displays followed cubers as cards/chips, enabling custom drag-and-drop placement between the top and bottom containers.</li>
                            </ul>
                        </li>
                        <li>
                            <strong className="text-text-primary">Timer Activation (Priming Length):</strong> Adjusts the required spacebar hold duration before the timer turns green and readies to start (0.10s to 2.00s; default 0.60s).
                        </li>
                        <li>
                            <strong className="text-text-primary">Display Sizing:</strong> Sliders and step controls to scale the primary solve timer typography (4.0rem – 14.0rem) and scramble text size (0.8rem – 3.0rem) with a live preview.
                        </li>
                        <li>
                            <strong className="text-text-primary">Show Inspection:</strong> Enables official 15-second WCA inspection with countdown alerts before the solve timer starts.
                        </li>
                        <li>
                            <strong className="text-text-primary">Show Timer During Solve:</strong> When enabled, shows live elapsed milliseconds while timing. When disabled, displays a static &quot;SOLVE&quot; banner to prevent distraction.
                        </li>
                        <li>
                            <strong className="text-text-primary">Custom Events:</strong> Create custom puzzle categories (e.g., FTO, Mirror Blocks, 3x3 OH) with an assigned WCA scramble generator or &quot;None&quot;. Custom events can be selected or removed at any time.
                        </li>
                    </ul>
                </section>

                {/* 2. Cube (Timer & Practice) */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        2. Cube (Timer &amp; Practice)
                    </h2>
                    <p>
                        The default landing page (<Link to="/" className="underline text-accent">cubeonline.org/</Link>) for individual and multiplayer speedcubing practice:
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Timing a Solve:</strong> Hold <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">Spacebar</kbd> until the digits turn green (primed), release to start, and press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">Spacebar</kbd> again upon puzzle completion to stop. On touchscreens, tap and hold the timing area.
                        </li>
                        <li>
                            <strong className="text-text-primary">WCA Inspection:</strong> When inspection is active, tap <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">Spacebar</kbd> to begin countdown. Hold to prime before 15 seconds. Exceeding 15 seconds incurs an automatic +2 penalty; exceeding 17 seconds results in DNF.
                        </li>
                        <li>
                            <strong className="text-text-primary">Quick Penalties:</strong> Within 5 seconds after stopping the timer, press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">F</kbd> to add a +2 penalty or <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">D</kbd> to apply DNF. You can also click the penalty chips directly on the time display.
                        </li>
                        <li>
                            <strong className="text-text-primary">Scramble Algorithms:</strong> Generated via client-side WebAssembly using official WCA random-state scrambling routines. Click the copy icon beside the scramble to copy it to clipboard.
                        </li>
                        <li>
                            <strong className="text-text-primary">Live Multiplayer Presence:</strong> Real-time cards and chips display other active solvers, showing whether they are currently inspecting, solving, or idle, alongside their recent times. Click a user to open their profile, or use the eye icon to minimize chips.
                        </li>
                        <li>
                            <strong className="text-text-primary">Session Statistics Sidebar:</strong> Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">Tab</kbd> to toggle the right panel. Displays session count, current Ao5, Ao12, Ao100, and session average. Click &quot;Best&quot; to toggle between current session bests and all-time records. Click any session to jump directly to its filtered solves in Logs.
                        </li>
                    </ul>
                </section>

                {/* 3. Logs (Analytics & Solve History) */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        3. Logs (Analytics &amp; Solves)
                    </h2>
                    <p>
                        Comprehensive solve management and performance telemetry (<Link to="/logs" className="underline text-accent">/logs</Link>):
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Solves Table:</strong> Lists every recorded solve with solve time, applied penalties, inspection duration, scramble algorithm, and timestamp. Click column headers to sort ascending or descending. Customize page size (25, 50, 100 solves).
                        </li>
                        <li>
                            <strong className="text-text-primary">Solve Inspector Pane:</strong> Click any solve in the table to open a slide-out details panel. Inspect full scrambles, adjust or toggle penalties (+2, DNF), copy solve data, or permanently delete the solve.
                        </li>
                        <li>
                            <strong className="text-text-primary">Sidebar Grouping Filters:</strong> Use the left Logs sidebar to group solves by Sessions, Days, Weeks, Months, or Years. Multi-select groups to isolate specific practice sessions. Export individual session solves or view granular session metrics.
                        </li>
                        <li>
                            <strong className="text-text-primary">Anomaly &amp; Outlier Detection:</strong> Algorithmic outlier detection flags unusually fast (e.g. accidental misclicks) or unusually slow times compared to your rolling average. Review, approve, or prune anomalies from your official records.
                        </li>
                        <li>
                            <strong className="text-text-primary">Activity Heatmap:</strong> A calendar heatmap showing daily solve counts and practice consistency over time.
                        </li>
                    </ul>
                </section>

                {/* 4. Goals (Milestones & Records) */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        4. Goals (Milestones &amp; Records)
                    </h2>
                    <p>
                        Track personal achievements, records, and long-term cubing milestones (<Link to="/goals" className="underline text-accent">/goals</Link>):
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Personal Records (PR) Table:</strong> Summarizes your all-time best Single, Ao5, Ao12, Ao50, and Ao100 across all practiced events.
                        </li>
                        <li>
                            <strong className="text-text-primary">Activity Squares:</strong> A 150-day interactive solve volume chart. Hover over any date to inspect exact solve counts and puzzle distribution breakdowns.
                        </li>
                        <li>
                            <strong className="text-text-primary">Milestone Categories:</strong> Track progression across four domains:
                            <ul className="list-circle pl-5 mt-1 space-y-1 text-xs">
                                <li><strong>Time:</strong> Event-specific speed thresholds (e.g., Sub-15 3x3, Sub-1:00 4x4).</li>
                                <li><strong>Count:</strong> Volume milestones based on total lifetime solves completed.</li>
                                <li><strong>Streak:</strong> Consistency rewards for consecutive daily practice streaks.</li>
                                <li><strong>Diversity:</strong> Puzzle versatility badges for completing solves across multiple events.</li>
                            </ul>
                        </li>
                        <li>
                            <strong className="text-text-primary">Pinning Goals:</strong> Pin up to 3 target goals to keep them visible at the top of your practice screen for motivation.
                        </li>
                        <li>
                            <strong className="text-text-primary">Global Percentile:</strong> Compares your total milestone progress against all cubers on Cube Online to compute your global completion rank.
                        </li>
                    </ul>
                </section>

                {/* 5. Social (Leaderboards & Community) */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        5. Social (Leaderboards &amp; Profiles)
                    </h2>
                    <p>
                        Connect with the cubing community and inspect rankings (<Link to="/social" className="underline text-accent">/social</Link>):
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Global Leaderboards:</strong> View community rankings sorted by Single, Ao5, and solve volume across any supported puzzle event.
                        </li>
                        <li>
                            <strong className="text-text-primary">User Profiles:</strong> Click any user to view their personal records, solve count, joined date, bio, and linked accounts (WCA ID, Discord, YouTube, GitHub).
                        </li>
                        <li>
                            <strong className="text-text-primary">Following &amp; Stars:</strong> Star cubers to follow them. Followed cubers are prioritized in your live multiplayer header and friend activity lists.
                        </li>
                        <li>
                            <strong className="text-text-primary">User Search:</strong> Search solvers quickly by username or short profile ID (e.g., <span className="font-mono text-xs">#AB12</span>).
                        </li>
                    </ul>
                </section>

                {/* 6. Arena (Live Multiplayer Battles) */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        6. Arena (Live Multiplayer Battles)
                    </h2>
                    <p>
                        Real-time competitive multiplayer cubing matches with team battles, spectator rooms, and automated bot opponents (<Link to="/arena" className="underline text-accent">/arena</Link>):
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">How Arena Matches Work:</strong> Solvers join a room and are placed on Red Team or Blue Team (or watch as spectators). When all active human solvers hold spacebar, the match locks in and triggers a drag race Christmas tree countdown (red light, progressive yellow staging lights, then sudden green light launch). All solvers solve the exact same scramble simultaneously.
                        </li>
                        <li>
                            <strong className="text-text-primary">Match Scoring &amp; Structure:</strong> Matches are structured into Games and Sets:
                            <ul className="list-circle pl-5 mt-1 space-y-1 text-xs">
                                <li><strong>Rank-Based Points:</strong> Each round awards points to finishers based on their finish order (faster solves earn more points, with DNF solves receiving zero).</li>
                                <li><strong>Winning Games &amp; Sets:</strong> The first team to accumulate the target Points to Win wins the game. Winning target games takes the set, and target sets secures match victory.</li>
                                <li><strong>False Start Penalties:</strong> Releasing the spacebar before the green light triggers a false start penalty scaled to the early delta (5x multiplier added to final solve time). Leaving early immediately switches the center console to show &quot;SOLVE&quot;.</li>
                            </ul>
                        </li>
                        <li>
                            <strong className="text-text-primary">Host Powers &amp; Rules:</strong> The room creator serves as authoritative match referee:
                            <ul className="list-circle pl-5 mt-1 space-y-1 text-xs">
                                <li><strong>Room Configuration:</strong> Set custom target sets, target games, and points-to-win thresholds. The scramble size automatically matches the host&apos;s timer settings.</li>
                                <li><strong>Team Management:</strong> Drag and drop players freely between Red Team, Blue Team, and Spectators.</li>
                                <li><strong>AI Bot Management:</strong> Add custom AI bots to either team. Click or edit bot cards to adjust average solve time and standard deviation in monospace format, or remove bots with the trash icon.</li>
                                <li><strong>Score &amp; Penalty Overrides:</strong> Manually increment or decrement game points, game wins, and set wins, and apply penalties. Host can also kick or ban disruptive players.</li>
                            </ul>
                        </li>
                        <li>
                            <strong className="text-text-primary">Guest Powers &amp; Experience:</strong>
                            <ul className="list-circle pl-5 mt-1 space-y-1 text-xs">
                                <li><strong>Match Participation:</strong> Once assigned to a team, hold spacebar to ready up. Release upon green to start solving, and tap spacebar to record your time.</li>
                                <li><strong>Self-Reporting Penalties:</strong> In the center solve history console, hover over your result to quickly self-report a +2 or DNF penalty.</li>
                                <li><strong>Continual Lobby Stats:</strong> Player cards display your rolling average and standard deviation based on all completed, non-DNF round times throughout the lobby session.</li>
                            </ul>
                        </li>
                    </ul>
                </section>

                {/* 7. Keybinds & Shortcuts */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        7. Keybinds &amp; Shortcuts
                    </h2>
                    <p>
                        Fast keyboard navigation and control reference (<Link to="/keybinds" className="underline text-accent">/keybinds</Link>):
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Navigation:</strong> Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">Esc</kbd> for Timer, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">L</kbd> for Logs, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">G</kbd> for Goals, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">S</kbd> for Social, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">A</kbd> for Arena, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">B</kbd> for Keybinds, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">Shift</kbd> to toggle the left sidebar, and <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">Tab</kbd> to toggle the right sidebar.
                        </li>
                        <li>
                            <strong className="text-text-primary">Puzzle Switching Hotkeys:</strong> Press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">2</kbd>–<kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">7</kbd> for 2x2 through 7x7, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">1</kbd> for Square-1, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">C</kbd> for Clock, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">M</kbd> for Megaminx, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">Y</kbd> for Pyraminx, <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">K</kbd> for Skewb, or <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">F</kbd> for FTO.
                        </li>
                        <li>
                            <strong className="text-text-primary">Timer Hotkeys:</strong> <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">Spacebar</kbd> (Prime/Start/Stop), <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">P</kbd> (Pass Scramble), <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">F</kbd> (+2 Fault penalty within 5s), and <kbd className="px-1.5 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded">D</kbd> (DNF penalty within 5s).
                        </li>
                    </ul>
                </section>

                {/* 8. Account & Data Management */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        8. Account &amp; Data Management
                    </h2>
                    <p>
                        Profile settings, data portability, and preferences (<Link to="/account" className="underline text-accent">/account</Link>):
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Identity &amp; Avatar:</strong> Customize your username and choose from 12 distinct profile theme colors. Copy your short profile code to share with friends.
                        </li>
                        <li>
                            <strong className="text-text-primary">Linked Social Accounts:</strong> Connect your World Cube Association (WCA) account, Discord, YouTube, Instagram, X/Twitter, or GitHub profiles.
                        </li>
                        <li>
                            <strong className="text-text-primary">csTimer Data Import:</strong> Seamlessly import past solve histories and sessions from exported csTimer JSON files.
                        </li>
                        <li>
                            <strong className="text-text-primary">Export Solves:</strong> Download all personal solve logs, scramble records, and session history as an open JSON file backup.
                        </li>
                        <li>
                            <strong className="text-text-primary">Ghost Mode:</strong> Toggle Ghost Mode under Cubing Friends settings to hide your live solve activity and online status from public presence.
                        </li>
                        <li>
                            <strong className="text-text-primary">Danger Zone:</strong> Clear all recorded solves or permanently erase your account and all associated cloud data.
                        </li>
                    </ul>
                </section>

                {/* 9. Developer Portal & Feedback */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        9. Developer Portal &amp; Feedback
                    </h2>
                    <p>
                        Community feedback and release history (<Link to="/dev" className="underline text-accent">/dev</Link>):
                    </p>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Bug Reports &amp; Feature Requests:</strong> Submit suggestions, bugs, or improvements with optional image/log attachments (compressed client-side before transmission).
                        </li>
                        <li>
                            <strong className="text-text-primary">Changelog:</strong> Chronological record of application updates, feature releases, performance optimizations, and bug fixes.
                        </li>
                    </ul>
                </section>

                {/* 10. Notifications, Theme & Offline Mode */}
                <section className="space-y-3">
                    <h2 className="text-base font-semibold text-text-primary">
                        10. Notifications, Themes &amp; Offline Mode
                    </h2>
                    <ul className="list-disc pl-5 space-y-2">
                        <li>
                            <strong className="text-text-primary">Notification Bell:</strong> Click the bell icon in the top bar to inspect system updates, milestone alerts, and announcements. Supports archiving and marking as read.
                        </li>
                        <li>
                            <strong className="text-text-primary">Theme Switcher:</strong> Located at the bottom of the left sidebar. Choose between Light, Dark, or System mode to match your operating system theme.
                        </li>
                        <li>
                            <strong className="text-text-primary">Guest &amp; Offline Operation:</strong> Guest visitors can use all timing and scrambling tools without logging in; data is stored 100% locally in your browser. Cube Online functions offline as a Progressive Web App (PWA).
                        </li>
                    </ul>
                </section>
            </div>
        </div>
    );
}

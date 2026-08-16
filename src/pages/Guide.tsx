import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Flame,
    Dices,
    HeartCrack,
    Coins,
    Sparkles,
    ShoppingBag,
    Volume2,
    Shield,
    TrendingUp,
    HelpCircle,
    ArrowRight,
    Palette,
    Info,
    RotateCcw
} from 'lucide-react';
import { COLOR_LADDER, GACHA_BOXES } from '../utils/cosmeticsData';

export default function Guide() {
    const [selectedTab, setSelectedTab] = useState<'all' | 'streak' | 'wager' | 'pity' | 'colors' | 'gacha' | 'audio'>('all');
    
    // Interactive wager calculator simulator state
    const [calcSessionAvg, setCalcSessionAvg] = useState<number>(15.0);
    const [calcTarget, setCalcTarget] = useState<number>(14.0);
    const [calcWagerAmount, setCalcWagerAmount] = useState<number>(50);

    // Calculate simulated odds
    const diffRatio = (calcSessionAvg - calcTarget) / calcSessionAvg;
    let simulatedOdds = 2.0;
    if (diffRatio < -0.1) simulatedOdds = 1.25;
    else if (diffRatio <= 0.05) simulatedOdds = 2.0;
    else if (diffRatio <= 0.2) simulatedOdds = 4.5;
    else if (diffRatio <= 0.35) simulatedOdds = 12.0;
    else simulatedOdds = 30.0;

    const simulatedPayout = Math.floor(calcWagerAmount * simulatedOdds);
    const simulatedProfit = simulatedPayout - calcWagerAmount;

    return (
        <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-300">
            {/* Header / Hero */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-bg-secondary via-bg-secondary to-bg-tertiary border border-border p-6 md:p-10 shadow-xl">
                <div className="relative z-10 max-w-3xl space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-wider">
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Game Mechanics & Economy Manual</span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-black text-text-primary tracking-tight">
                        Cube Online Mechanics
                    </h1>

                    <p className="text-sm md:text-base text-text-secondary leading-relaxed">
                        Learn how the Push-Your-Luck streak multiplier, performance wagering, heartbreak pity system, and exponential color progression work to elevate your speedcubing grind.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <Link
                            to="/store"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white font-bold text-xs rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-accent/20"
                        >
                            <ShoppingBag className="w-4 h-4" />
                            <span>Visit Store</span>
                        </Link>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-bg-primary hover:bg-bg-hover text-text-primary border border-border font-bold text-xs rounded-xl transition-colors"
                        >
                            <ArrowRight className="w-4 h-4" />
                            <span>Start Solving</span>
                        </Link>
                    </div>
                </div>

                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 opacity-5 pointer-events-none hidden lg:block">
                    <Dices className="w-96 h-96 text-text-primary" />
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-border/60">
                {[
                    { id: 'all', label: 'All Mechanics', icon: Sparkles },
                    { id: 'streak', label: 'Push-Your-Luck', icon: Flame },
                    { id: 'wager', label: 'Wagering', icon: Dices },
                    { id: 'pity', label: 'Heartbreak Pity', icon: HeartCrack },
                    { id: 'colors', label: 'Color Ladder', icon: Palette },
                    { id: 'gacha', label: 'Gacha Capsules', icon: Coins },
                    { id: 'audio', label: 'Sound Packs', icon: Volume2 }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setSelectedTab(tab.id as any)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                            selectedTab === tab.id
                                ? 'bg-text-primary text-bg-primary shadow-sm'
                                : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-border/50'
                        }`}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* 1. PUSH-YOUR-LUCK STREAK MULTIPLIER */}
            {(selectedTab === 'all' || selectedTab === 'streak') && (
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                            <Flame className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-text-primary">1. Push-Your-Luck Streak Multiplier</h2>
                            <p className="text-xs text-text-secondary">Compound your earnings by beating your session average repeatedly.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-orange-400 uppercase">
                                <TrendingUp className="w-4 h-4" />
                                <span>Base Win Rule</span>
                            </div>
                            <h3 className="text-base font-bold text-text-primary">Beat Session Average</h3>
                            <p className="text-xs text-text-secondary leading-relaxed">
                                Every solve completed faster than your active session average yields <span className="font-mono text-amber-400 font-bold">10 Base Coins</span> into your unbanked streak pot.
                            </p>
                        </div>

                        <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase">
                                <RotateCcw className="w-4 h-4" />
                                <span>Let It Ride</span>
                            </div>
                            <h3 className="text-base font-bold text-text-primary">Exponential 2x Doubling</h3>
                            <p className="text-xs text-text-secondary leading-relaxed">
                                When <strong>"Let It Ride"</strong> is active, every consecutive winning solve doubles your multiplier: <span className="font-mono font-bold text-text-primary">10 → 20 → 40 → 80 → 160 → 320 coins</span> (<span className="font-mono">2^(N-1)</span>).
                            </p>
                        </div>

                        <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase">
                                <Shield className="w-4 h-4" />
                                <span>Bank vs Bust</span>
                            </div>
                            <h3 className="text-base font-bold text-text-primary">Lock In or Risk It All</h3>
                            <p className="text-xs text-text-secondary leading-relaxed">
                                Click <strong>"Bank"</strong> anytime to safely secure your pot into your wallet. If you solve slower than your average (or get a DNF) while riding, your unbanked pot busts to 0!
                            </p>
                        </div>
                    </div>

                    {/* Streak Step Progression Table */}
                    <div className="p-5 bg-bg-secondary/60 border border-border rounded-2xl overflow-x-auto">
                        <div className="text-xs font-bold uppercase text-text-secondary mb-3 tracking-wider">Streak Multiplier Progression Table</div>
                        <table className="w-full text-xs text-left">
                            <thead>
                                <tr className="border-b border-border/60 text-text-secondary">
                                    <th className="py-2 pr-4 font-bold">Streak Solve</th>
                                    <th className="py-2 pr-4 font-bold">Multiplier</th>
                                    <th className="py-2 pr-4 font-bold">Solve Payout</th>
                                    <th className="py-2 font-bold">Cumulative Unbanked Pot</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/20 font-mono">
                                {[
                                    { solve: 1, mult: '1x', solvePayout: 10, total: 10 },
                                    { solve: 2, mult: '2x', solvePayout: 20, total: 30 },
                                    { solve: 3, mult: '4x', solvePayout: 40, total: 70 },
                                    { solve: 4, mult: '8x', solvePayout: 80, total: 150 },
                                    { solve: 5, mult: '16x', solvePayout: 160, total: 310 },
                                    { solve: 6, mult: '32x', solvePayout: 320, total: 630 },
                                    { solve: 7, mult: '64x', solvePayout: 640, total: 1270 },
                                ].map(row => (
                                    <tr key={row.solve} className="hover:bg-bg-hover/40 transition-colors">
                                        <td className="py-2 pr-4 text-text-primary font-bold">Solve #{row.solve}</td>
                                        <td className="py-2 pr-4 text-orange-400 font-bold">{row.mult}</td>
                                        <td className="py-2 pr-4 text-amber-400">+{row.solvePayout} Coins</td>
                                        <td className="py-2 text-emerald-400 font-bold">{row.total} Coins</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* 2. PERFORMANCE WAGERING */}
            {(selectedTab === 'all' || selectedTab === 'wager') && (
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <Dices className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-text-primary">2. Performance Wagering (Bet On Yourself)</h2>
                            <p className="text-xs text-text-secondary">Wager your coins prior to solving with algorithmic dynamic odds.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-3">
                            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Default Wager Presets</h3>
                            <div className="space-y-2 text-xs">
                                <div className="p-3 bg-bg-primary border border-border rounded-xl flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-text-primary">Safe Bet (Sub-Avg + 1.0s)</div>
                                        <div className="text-text-secondary text-[11px]">Generous margin above average.</div>
                                    </div>
                                    <div className="text-right font-mono font-bold text-emerald-400">1.3x Payout</div>
                                </div>

                                <div className="p-3 bg-bg-primary border border-border rounded-xl flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-text-primary">Even Money (Sub-Avg)</div>
                                        <div className="text-text-secondary text-[11px]">Beat your current session average.</div>
                                    </div>
                                    <div className="text-right font-mono font-bold text-emerald-400">2.0x Payout</div>
                                </div>

                                <div className="p-3 bg-bg-primary border border-border rounded-xl flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-text-primary">Fast Pace (Target Solve)</div>
                                        <div className="text-text-secondary text-[11px]">Pushing for a top-tier solve.</div>
                                    </div>
                                    <div className="text-right font-mono font-bold text-emerald-400">4.0x Payout</div>
                                </div>

                                <div className="p-3 bg-bg-primary border border-border rounded-xl flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-text-primary">God Solve (Near PB Single)</div>
                                        <div className="text-text-secondary text-[11px]">Near all-time personal best territory.</div>
                                    </div>
                                    <div className="text-right font-mono font-bold text-purple-400">10.0x Payout</div>
                                </div>

                                <div className="p-3 bg-bg-primary border border-border rounded-xl flex items-center justify-between">
                                    <div>
                                        <div className="font-bold text-text-primary">PB Buster (Break PB)</div>
                                        <div className="text-text-secondary text-[11px]">Set a new all-time Personal Best single.</div>
                                    </div>
                                    <div className="text-right font-mono font-bold text-amber-400">25.0x Payout</div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive Odds Calculator Simulator */}
                        <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-bold text-accent uppercase mb-1">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Interactive Odds Simulator</span>
                                </div>
                                <h3 className="text-base font-bold text-text-primary mb-2">Test Custom Target Payouts</h3>
                                <p className="text-xs text-text-secondary mb-4">
                                    Odds are dynamically generated by evaluating how difficult the target is compared to your active session average.
                                </p>

                                <div className="space-y-3 text-xs">
                                    <div>
                                        <label className="block text-text-secondary font-medium mb-1">Session Average (seconds):</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={calcSessionAvg}
                                            onChange={e => setCalcSessionAvg(Math.max(1, parseFloat(e.target.value) || 15))}
                                            className="w-full bg-bg-primary border border-border rounded-xl px-3 py-1.5 font-mono text-text-primary focus:outline-none focus:border-accent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-text-secondary font-medium mb-1">Target Solve Time (seconds):</label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={calcTarget}
                                            onChange={e => setCalcTarget(Math.max(0.5, parseFloat(e.target.value) || 10))}
                                            className="w-full bg-bg-primary border border-border rounded-xl px-3 py-1.5 font-mono text-text-primary focus:outline-none focus:border-accent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-text-secondary font-medium mb-1">Wager Amount (coins):</label>
                                        <input
                                            type="number"
                                            step="10"
                                            value={calcWagerAmount}
                                            onChange={e => setCalcWagerAmount(Math.max(1, parseInt(e.target.value) || 50))}
                                            className="w-full bg-bg-primary border border-border rounded-xl px-3 py-1.5 font-mono text-text-primary focus:outline-none focus:border-accent"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-bg-primary border border-border/80 rounded-xl space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-text-secondary">Calculated Odds:</span>
                                    <span className="font-mono font-bold text-accent text-sm">{simulatedOdds}x</span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-text-secondary">Total Return:</span>
                                    <span className="font-mono font-bold text-emerald-400 text-sm">{simulatedPayout} Coins</span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                                    <span className="text-text-secondary">Net Profit:</span>
                                    <span className="font-mono font-bold text-text-primary text-sm">+{simulatedProfit} Coins</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* 3. NEAR-MISS PITY SYSTEM */}
            {(selectedTab === 'all' || selectedTab === 'pity') && (
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <HeartCrack className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-text-primary">3. Near-Miss Pity System (Heartbreak Tokens)</h2>
                            <p className="text-xs text-text-secondary">Turn agonizing near-misses into high-tier loot.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase">
                                <Info className="w-4 h-4" />
                                <span>Trigger Conditions</span>
                            </div>
                            <h3 className="text-base font-bold text-text-primary">How to Earn Heartbreak Tokens</h3>
                            <ul className="space-y-2 text-xs text-text-secondary leading-relaxed list-disc list-inside">
                                <li>
                                    <strong className="text-text-primary">The 0.10s Heartbreak:</strong> If your solve is within <span className="font-mono text-rose-400 font-bold">&le; 0.10s</span> of your all-time Personal Best single without beating it.
                                </li>
                                <li>
                                    <strong className="text-text-primary">The +2 Choke:</strong> If your raw timer was fast enough to beat your PB, but a <span className="font-mono text-orange-400 font-bold">+2 penalty</span> pushed it over your PB.
                                </li>
                            </ul>
                        </div>

                        <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-3 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 text-xs font-bold text-rose-400 uppercase">
                                    <ShoppingBag className="w-4 h-4" />
                                    <span>Store Redemption</span>
                                </div>
                                <h3 className="text-base font-bold text-text-primary mb-1">Heartbreak Pity Crate</h3>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                    Collect <span className="font-bold text-rose-400 font-mono">5 Heartbreak Tokens</span> to unlock the exclusive Heartbreak Pity Crate in the Store. It contains 0% Common items and high odds for Epic and Legendary cosmetics!
                                </p>
                            </div>

                            <Link
                                to="/store"
                                className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors"
                            >
                                <HeartCrack className="w-4 h-4" />
                                <span>View Heartbreak Crate in Store</span>
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* 4. COLOR PRICE LADDER */}
            {(selectedTab === 'all' || selectedTab === 'colors') && (
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-accent/10 text-accent border border-accent/20">
                            <Palette className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-text-primary">4. Exponential Color Price Ladder</h2>
                            <p className="text-xs text-text-secondary">Start with Crimson Red and climb the exponential ladder to the impossible 1 Billion Coin Red Circle.</p>
                        </div>
                    </div>

                    <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {COLOR_LADDER.map((c, i) => (
                                <div
                                    key={c.id}
                                    className="p-3 bg-bg-primary border border-border/80 rounded-xl flex items-center justify-between gap-3"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-8 h-8 rounded-lg shadow-sm shrink-0 border border-white/20"
                                            style={{ backgroundColor: c.hex }}
                                        />
                                        <div>
                                            <div className="text-xs font-bold text-text-primary">
                                                Tier {i + 1}: {c.name}
                                            </div>
                                            <div className="text-[10px] font-mono text-text-secondary">{c.hex}</div>
                                        </div>
                                    </div>

                                    <div className="text-right font-mono text-xs font-bold">
                                        {c.price === 0 ? (
                                            <span className="text-emerald-400">Free</span>
                                        ) : (
                                            <span className="text-amber-400">{c.price.toLocaleString()} Coins</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* 5. GACHA CAPSULES & DROP RATES */}
            {(selectedTab === 'all' || selectedTab === 'gacha') && (
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <Coins className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-text-primary">5. Gacha Loot Capsules & Drop Rates</h2>
                            <p className="text-xs text-text-secondary">Spend your hard-earned coins and tokens on cosmetic drops.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {GACHA_BOXES.map(box => {
                            const rates = box.id === 'heartbreak'
                                ? { common: 0, rare: 0, epic: 75, legendary: 25 }
                                : box.id === 'high_roller'
                                ? { common: 0, rare: 65, epic: 27, legendary: 8 }
                                : { common: 60, rare: 28, epic: 10, legendary: 2 };

                            return (
                                <div key={box.id} className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-4 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-base font-bold text-text-primary">{box.name}</h3>
                                            <div className="text-xs font-mono font-bold text-amber-400">
                                                {box.currency === 'coins' ? `${box.cost} Coins` : `${box.cost} Heartbreak Tokens`}
                                            </div>
                                        </div>
                                        <p className="text-xs text-text-secondary mb-4 leading-relaxed">{box.description}</p>

                                        <div className="space-y-1.5 text-xs font-mono">
                                            <div className="flex items-center justify-between text-zinc-400">
                                                <span>Common:</span>
                                                <span>{rates.common}%</span>
                                            </div>
                                            <div className="flex items-center justify-between text-blue-400">
                                                <span>Rare:</span>
                                                <span>{rates.rare}%</span>
                                            </div>
                                            <div className="flex items-center justify-between text-purple-400">
                                                <span>Epic:</span>
                                                <span>{rates.epic}%</span>
                                            </div>
                                            <div className="flex items-center justify-between text-amber-400 font-bold">
                                                <span>Legendary:</span>
                                                <span>{rates.legendary}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-[11px] text-text-secondary/70 pt-2 border-t border-border/40 italic">
                                        Duplicate protection: Duplicates automatically refund bonus coins based on item rarity.
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* 6. AUDIO & THEMES */}
            {(selectedTab === 'all' || selectedTab === 'audio') && (
                <section className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            <Volume2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-text-primary">6. Sound FX Packs & Theme Palettes</h2>
                            <p className="text-xs text-text-secondary">Custom synthesized audio engines and UI color palettes unlocked via the Store.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-2">
                            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Zero-Latency Web Audio Packs</h3>
                            <p className="text-xs text-text-secondary leading-relaxed mb-3">
                                Audio cues are synthesized directly in your browser with zero latency. Unlock different sound packs:
                            </p>
                            <div className="space-y-1.5 text-xs">
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-text-primary">Classic Standard (Smooth beeps & chimes)</div>
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-text-primary">Cherry MX Mechanical (Tactile mechanical key clicks)</div>
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-text-primary">8-Bit Retro Arcade (Vintage square waves & arpeggios)</div>
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-text-primary">Cyber Sci-Fi (Futuristic FM synth pulses)</div>
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-text-primary">Casino Royale (Roulette clicks & slot machine bells)</div>
                            </div>
                        </div>

                        <div className="p-5 bg-bg-secondary border border-border rounded-2xl space-y-2">
                            <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">Unlockable Themes & Skins</h3>
                            <p className="text-xs text-text-secondary leading-relaxed mb-3">
                                Equip distinct aesthetic visual themes and scramble visualizer skins:
                            </p>
                            <div className="space-y-1.5 text-xs">
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-purple-400">Synthwave 1984 (Neon pink & cyan glow)</div>
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-yellow-400">Cyberpunk 2077 (High-contrast yellow & cyan)</div>
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-emerald-400">The Matrix (Terminal emerald greens)</div>
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-rose-400">Blood Moon (Crimson dark mode)</div>
                                <div className="p-2 bg-bg-primary rounded-lg font-mono text-cyan-400">Holographic Prismatic (Iridescent sheen)</div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* Bottom Call to Action */}
            <div className="p-6 md:p-8 bg-bg-secondary border border-border rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-text-primary mb-1">Ready to test your algorithms?</h3>
                    <p className="text-xs text-text-secondary">Head back to the timer or visit the Store to gear up.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        to="/store"
                        className="px-4 py-2 bg-bg-hover hover:bg-border text-text-primary font-bold text-xs rounded-xl transition-colors"
                    >
                        Store & Wardrobe
                    </Link>
                    <Link
                        to="/"
                        className="px-5 py-2 bg-accent text-white font-bold text-xs rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-accent/20"
                    >
                        Go to Timer
                    </Link>
                </div>
            </div>
        </div>
    );
}

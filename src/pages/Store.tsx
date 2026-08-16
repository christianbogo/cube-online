import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Coins,
    Sparkles,
    Circle,
    Lock,
    Check,
    Palette,
    Volume2,
    Tag,
    Box,
    Layers,
    HeartCrack,
    Info,
    Flame,
    ArrowUpRight,
    HelpCircle,
    X
} from 'lucide-react';
import { useEconomy } from '../contexts/EconomyContext';
import { COLOR_LADDER, GACHA_BOXES, COSMETICS_CATALOG } from '../utils/cosmeticsData';
import { soundEngine } from '../utils/soundEngine';
import type { CosmeticItem, CosmeticRarity } from '../types/economy';

export default function Store() {
    const {
        economy,
        purchaseColor,
        equipColor,
        openGachaBox,
        equipCosmetic
    } = useEconomy();

    const [activeTab, setActiveTab] = useState<'colors' | 'gacha' | 'inventory'>('colors');
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'title' | 'theme' | 'sound' | 'cubeSkin'>('all');

    // Gacha Animation Modal State
    const [isOpening, setIsOpening] = useState(false);
    const [openedItem, setOpenedItem] = useState<{
        item: CosmeticItem;
        isDuplicate: boolean;
        duplicateCompensation: number;
    } | null>(null);
    const [openingBoxId, setOpeningBoxId] = useState<'standard' | 'high_roller' | 'heartbreak' | null>(null);
    const [ratesModalOpen, setRatesModalOpen] = useState(false);
    const [purchaseError, setPurchaseError] = useState<string | null>(null);

    const handleBuyColor = (hex: string) => {
        setPurchaseError(null);
        const res = purchaseColor(hex);
        if (!res.success && res.error) {
            setPurchaseError(res.error);
            setTimeout(() => setPurchaseError(null), 3000);
        }
    };

    const handleOpenBox = (boxId: 'standard' | 'high_roller' | 'heartbreak') => {
        setPurchaseError(null);
        setOpeningBoxId(boxId);
        setIsOpening(true);
        setOpenedItem(null);

        // Sound effect for suspense
        let tickCount = 0;
        const tickInterval = setInterval(() => {
            tickCount++;
            soundEngine.playGachaTick(0.8 + tickCount * 0.05);
            if (tickCount > 10) clearInterval(tickInterval);
        }, 120);

        setTimeout(() => {
            clearInterval(tickInterval);
            const result = openGachaBox(boxId);
            setIsOpening(false);
            if (result.success && result.item) {
                setOpenedItem({
                    item: result.item,
                    isDuplicate: !!result.isDuplicate,
                    duplicateCompensation: result.duplicateCompensation || 0
                });
            } else if (result.error) {
                setPurchaseError(result.error);
                setOpeningBoxId(null);
            }
        }, 1500);
    };

    const getRarityBadgeStyle = (rarity: CosmeticRarity) => {
        switch (rarity) {
            case 'legendary':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
            case 'epic':
                return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
            case 'rare':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
            case 'common':
            default:
                return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
        }
    };

    const filteredInventory = COSMETICS_CATALOG.filter(c => {
        const isUnlocked = economy.unlockedCosmetics.includes(c.id);
        if (!isUnlocked) return false;
        if (selectedCategory === 'all') return true;
        return c.category === selectedCategory;
    });

    return (
        <div className="w-full h-full flex flex-col overflow-y-auto custom-scrollbar select-none pb-12">
            {/* Store Header with Balance Counters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border/50">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-6 h-6 text-accent" />
                        <h1 className="text-2xl md:text-3xl font-bold text-text-primary">Cubing Store & Vault</h1>
                    </div>
                    <p className="text-xs md:text-sm text-text-secondary">
                        Wager coins, ride your multipliers, and acquire rare cosmetic unlocks.
                    </p>
                </div>

                {/* Balance Badges */}
                <div className="flex items-center gap-3">
                    {/* Coins Wallet */}
                    <div className="flex items-center gap-2.5 px-4 py-2 bg-bg-secondary border border-border rounded-xl shadow-sm">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                            <Coins className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Coins</div>
                            <div className="text-sm md:text-base font-bold font-mono text-text-primary">
                                {economy.coins.toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {/* Heartbreak Tokens (Pity) */}
                    <div className="flex items-center gap-2.5 px-4 py-2 bg-bg-secondary border border-border rounded-xl shadow-sm">
                        <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                            <HeartCrack className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-text-secondary tracking-wider">Heartbreak Tokens</div>
                            <div className="text-sm md:text-base font-bold font-mono text-text-primary">
                                {economy.heartbreakTokens.toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Banner */}
            {purchaseError && (
                <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs md:text-sm text-red-500 flex items-center justify-between animate-in fade-in">
                    <span>{purchaseError}</span>
                    <button onClick={() => setPurchaseError(null)} className="p-1 hover:bg-red-500/20 rounded">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Store Navigation Tabs */}
            <div className="flex items-center gap-2 mb-6 border-b border-border/40 pb-2">
                <button
                    onClick={() => setActiveTab('colors')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        activeTab === 'colors'
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    }`}
                >
                    <Palette className="w-4 h-4" />
                    <span>Color Ladder</span>
                </button>

                <button
                    onClick={() => setActiveTab('gacha')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        activeTab === 'gacha'
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    }`}
                >
                    <Box className="w-4 h-4" />
                    <span>Capsules & Loot Boxes</span>
                </button>

                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        activeTab === 'inventory'
                            ? 'bg-accent text-white shadow-sm'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    <span>My Wardrobe</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-bg-tertiary text-text-secondary ml-1">
                        {economy.unlockedCosmetics.length}
                    </span>
                </button>

                <Link
                    to="/guide"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors ml-auto"
                >
                    <HelpCircle className="w-4 h-4" />
                    <span>Mechanics Guide</span>
                </Link>
            </div>

            {/* TAB 1: COLOR LADDER */}
            {activeTab === 'colors' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-text-primary">Exponential Color Ladder</h2>
                            <p className="text-xs text-text-secondary">
                                Users start exclusively with Crimson Red. Unlock premium colors as your fortune grows.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {COLOR_LADDER.map((item) => {
                            const isUnlocked = economy.unlockedColors.includes(item.hex);
                            const isEquipped = economy.equippedColor === item.hex;
                            const canAfford = economy.coins >= item.price;

                            return (
                                <div
                                    key={item.id}
                                    className={`relative p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                                        item.isImpossible
                                            ? 'bg-gradient-to-b from-red-950/20 to-bg-secondary border-red-500/40 hover:border-red-500/80 shadow-lg shadow-red-950/20'
                                            : isEquipped
                                            ? 'bg-bg-secondary border-accent shadow-sm'
                                            : 'bg-bg-secondary border-border/60 hover:border-border'
                                    }`}
                                >
                                    {/* Impossible Badge */}
                                    {item.isImpossible && (
                                        <div className="absolute -top-2.5 right-4 bg-red-600 text-white text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse">
                                            <Flame className="w-3 h-3" />
                                            <span>Mythical Sphere</span>
                                        </div>
                                    )}

                                    <div>
                                        {/* Color Avatar Preview */}
                                        <div className="flex items-center gap-3.5 mb-3.5">
                                            <div
                                                className={`w-12 h-12 ${item.isImpossible ? 'rounded-full ring-4 ring-red-500/30' : 'rounded-xl'} shadow-inner flex items-center justify-center shrink-0 transition-transform`}
                                                style={{ backgroundColor: item.hex }}
                                            >
                                                {isEquipped && <Check className="w-5 h-5 text-white stroke-[3]" />}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <h3 className="font-bold text-sm text-text-primary truncate">{item.name}</h3>
                                                    {item.isImpossible && (
                                                        <Circle className="w-3 h-3 text-red-500 fill-red-500 shrink-0" />
                                                    )}
                                                </div>
                                                <div className="text-[11px] font-mono text-text-secondary uppercase">
                                                    {item.hex}
                                                </div>
                                            </div>
                                        </div>

                                        <p className="text-xs text-text-secondary leading-relaxed mb-4 line-clamp-2">
                                            {item.description}
                                        </p>
                                    </div>

                                    {/* Action Buttons & Pricing */}
                                    <div className="pt-3 border-t border-border/30 flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1 text-xs font-mono font-bold text-text-primary">
                                            {item.price === 0 ? (
                                                <span className="text-text-secondary">Default</span>
                                            ) : (
                                                <>
                                                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                                                    <span>{item.price.toLocaleString()}</span>
                                                </>
                                            )}
                                        </div>

                                        {isUnlocked ? (
                                            isEquipped ? (
                                                <div className="text-xs font-bold text-accent flex items-center gap-1 px-3 py-1.5 bg-accent/10 rounded-lg">
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>Equipped</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => equipColor(item.hex)}
                                                    className="px-3.5 py-1.5 text-xs font-bold bg-bg-hover hover:bg-border text-text-primary rounded-lg transition-colors cursor-pointer"
                                                >
                                                    Equip
                                                </button>
                                            )
                                        ) : (
                                            <button
                                                onClick={() => handleBuyColor(item.hex)}
                                                disabled={!canAfford}
                                                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                                    canAfford
                                                        ? 'bg-text-primary text-bg-primary hover:opacity-90 active:scale-95 shadow-sm'
                                                        : 'bg-bg-tertiary text-text-secondary/50 cursor-not-allowed opacity-60'
                                                }`}
                                            >
                                                {!canAfford && <Lock className="w-3 h-3" />}
                                                <span>Unlock</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 2: GACHA & LOOT BOXES */}
            {activeTab === 'gacha' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-bold text-text-primary">Cosmetic Loot Capsules</h2>
                            <p className="text-xs text-text-secondary">
                                Unlock custom themes, tactile sound packs, elite titles, and scramble visualizers.
                            </p>
                        </div>

                        <button
                            onClick={() => setRatesModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary px-3 py-1.5 bg-bg-secondary border border-border rounded-lg transition-colors cursor-pointer"
                        >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>Drop Rates</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {GACHA_BOXES.map((box) => {
                            const hasCurrency = box.currency === 'coins'
                                ? economy.coins >= box.cost
                                : economy.heartbreakTokens >= box.cost;

                            return (
                                <div
                                    key={box.id}
                                    className={`p-6 rounded-2xl border flex flex-col justify-between relative overflow-hidden transition-all ${
                                        box.id === 'heartbreak'
                                            ? 'bg-gradient-to-b from-rose-950/20 to-bg-secondary border-rose-500/30 hover:border-rose-500/60'
                                            : box.id === 'high_roller'
                                            ? 'bg-gradient-to-b from-amber-950/20 to-bg-secondary border-amber-500/30 hover:border-amber-500/60'
                                            : 'bg-bg-secondary border-border/80 hover:border-border'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                                box.id === 'heartbreak'
                                                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                                    : box.id === 'high_roller'
                                                    ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                    : 'bg-accent/10 text-accent border border-accent/20'
                                            }`}>
                                                {box.id === 'heartbreak' ? (
                                                    <HeartCrack className="w-6 h-6" />
                                                ) : (
                                                    <Box className="w-6 h-6" />
                                                )}
                                            </div>

                                            {box.guaranteedMinRarity && (
                                                <div className={`text-[10px] uppercase font-extrabold px-2.5 py-1 rounded-full border ${getRarityBadgeStyle(box.guaranteedMinRarity)}`}>
                                                    Guaranteed {box.guaranteedMinRarity}+
                                                </div>
                                            )}
                                        </div>

                                        <h3 className="font-bold text-base text-text-primary mb-1">{box.name}</h3>
                                        <p className="text-xs text-text-secondary leading-relaxed mb-6">
                                            {box.description}
                                        </p>
                                    </div>

                                    <div className="pt-4 border-t border-border/30 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-1.5 font-mono font-bold text-sm text-text-primary">
                                            {box.currency === 'coins' ? (
                                                <>
                                                    <Coins className="w-4 h-4 text-amber-500" />
                                                    <span>{box.cost.toLocaleString()}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <HeartCrack className="w-4 h-4 text-rose-500" />
                                                    <span>{box.cost} Tokens</span>
                                                </>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleOpenBox(box.id)}
                                            disabled={!hasCurrency || isOpening}
                                            className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                                                hasCurrency && !isOpening
                                                    ? 'bg-text-primary text-bg-primary hover:opacity-90 active:scale-95 shadow-md'
                                                    : 'bg-bg-tertiary text-text-secondary/50 cursor-not-allowed opacity-60'
                                            }`}
                                        >
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span>Open Capsule</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* TAB 3: WARDROBE & INVENTORY */}
            {activeTab === 'inventory' && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-text-primary">Cosmetic Wardrobe</h2>
                            <p className="text-xs text-text-secondary">
                                Equip unlocked player titles, audio sound packs, UI themes, and scramble visualizer skins.
                            </p>
                        </div>

                        {/* Category Filter Pills */}
                        <div className="flex items-center gap-1 bg-bg-secondary p-1 rounded-xl border border-border/60">
                            {(['all', 'title', 'theme', 'sound', 'cubeSkin'] as const).map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                                        selectedCategory === cat
                                            ? 'bg-bg-hover text-text-primary shadow-sm font-bold'
                                            : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                >
                                    {cat === 'all' && 'All'}
                                    {cat === 'title' && 'Titles'}
                                    {cat === 'theme' && 'Themes'}
                                    {cat === 'sound' && 'Sound FX'}
                                    {cat === 'cubeSkin' && 'Visualizer'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredInventory.length === 0 ? (
                        <div className="p-12 text-center bg-bg-secondary rounded-2xl border border-border/40 flex flex-col items-center justify-center gap-3">
                            <Box className="w-10 h-10 text-text-secondary/30" />
                            <div className="font-bold text-sm text-text-primary">No cosmetics unlocked in this category yet.</div>
                            <button
                                onClick={() => setActiveTab('gacha')}
                                className="mt-2 text-xs font-bold text-accent hover:underline flex items-center gap-1"
                            >
                                <span>Open Capsules in Store</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredInventory.map((item) => {
                                const isEquipped = (
                                    (item.category === 'title' && economy.equippedCosmetics.title === item.name) ||
                                    (item.category === 'theme' && economy.equippedCosmetics.theme === (item.value || item.id)) ||
                                    (item.category === 'sound' && economy.equippedCosmetics.sound === (item.value || item.id)) ||
                                    (item.category === 'cubeSkin' && economy.equippedCosmetics.cubeSkin === (item.value || item.id))
                                );

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4 rounded-xl border flex flex-col justify-between transition-all bg-bg-secondary ${
                                            isEquipped ? 'border-accent shadow-sm' : 'border-border/60 hover:border-border'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-md border ${getRarityBadgeStyle(item.rarity)}`}>
                                                    {item.rarity}
                                                </span>
                                                <span className="text-[10px] text-text-secondary uppercase font-semibold">
                                                    {item.category}
                                                </span>
                                            </div>

                                            <h4 className="font-bold text-sm text-text-primary mb-1">{item.name}</h4>
                                            <p className="text-xs text-text-secondary line-clamp-2 mb-4">
                                                {item.description}
                                            </p>
                                        </div>

                                        <div className="pt-3 border-t border-border/30 flex items-center justify-end">
                                            {isEquipped ? (
                                                <div className="text-xs font-bold text-accent flex items-center gap-1">
                                                    <Check className="w-3.5 h-3.5" />
                                                    <span>Equipped</span>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => equipCosmetic(item.category, item.id)}
                                                    className="px-3 py-1.5 text-xs font-bold bg-bg-hover hover:bg-border text-text-primary rounded-lg transition-colors cursor-pointer"
                                                >
                                                    Equip
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* UNBOXING ANIMATION MODAL */}
            {(isOpening || openedItem) && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-bg-secondary border border-border rounded-3xl p-8 max-w-md w-full text-center shadow-2xl flex flex-col items-center relative overflow-hidden">
                        {isOpening ? (
                            <div className="py-12 flex flex-col items-center gap-6">
                                <div className="w-24 h-24 rounded-3xl bg-accent/20 border-2 border-accent/40 flex items-center justify-center text-accent animate-bounce">
                                    <Box className="w-12 h-12 animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-text-primary mb-1">
                                        {openingBoxId === 'high_roller' ? 'Opening High Roller Case...' : openingBoxId === 'heartbreak' ? 'Opening Heartbreak Pity Crate...' : 'Opening Standard Capsule...'}
                                    </h3>
                                    <p className="text-xs text-text-secondary">Generating random cosmetic roll...</p>
                                </div>
                            </div>
                        ) : openedItem ? (
                            <div className="py-4 flex flex-col items-center w-full animate-in zoom-in-95 duration-300">
                                <div className={`mb-3 text-[10px] uppercase font-extrabold px-3 py-1 rounded-full border ${getRarityBadgeStyle(openedItem.item.rarity)}`}>
                                    {openedItem.item.rarity} Unlocked!
                                </div>

                                <div className="w-20 h-20 rounded-2xl bg-bg-tertiary border border-border flex items-center justify-center mb-4 shadow-lg">
                                    {openedItem.item.category === 'title' && <Tag className="w-10 h-10 text-accent" />}
                                    {openedItem.item.category === 'theme' && <Palette className="w-10 h-10 text-purple-400" />}
                                    {openedItem.item.category === 'sound' && <Volume2 className="w-10 h-10 text-blue-400" />}
                                    {openedItem.item.category === 'cubeSkin' && <Box className="w-10 h-10 text-amber-400" />}
                                </div>

                                <h3 className="text-2xl font-bold text-text-primary mb-1">{openedItem.item.name}</h3>
                                <p className="text-xs text-text-secondary mb-4 max-w-xs">{openedItem.item.description}</p>

                                {openedItem.isDuplicate && (
                                    <div className="mb-4 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 flex items-center gap-2">
                                        <Coins className="w-4 h-4 shrink-0" />
                                        <span>Duplicate item! Converted to +{openedItem.duplicateCompensation} Coins.</span>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 w-full mt-4">
                                    {!openedItem.isDuplicate && (
                                        <button
                                            onClick={() => {
                                                equipCosmetic(openedItem.item.category, openedItem.item.id);
                                                setOpenedItem(null);
                                            }}
                                            className="flex-1 py-2.5 bg-accent text-white font-bold text-xs rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
                                        >
                                            Equip Now
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setOpenedItem(null)}
                                        className="flex-1 py-2.5 bg-bg-hover hover:bg-border text-text-primary font-bold text-xs rounded-xl transition-colors cursor-pointer"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {/* DROP RATES MODAL */}
            {ratesModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-bg-secondary border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base text-text-primary flex items-center gap-2">
                                <Info className="w-4 h-4 text-accent" />
                                <span>Capsule Drop Rates</span>
                            </h3>
                            <button onClick={() => setRatesModalOpen(false)} className="p-1 text-text-secondary hover:text-text-primary rounded">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div className="p-3 bg-bg-primary rounded-xl border border-border/40">
                                <div className="font-bold text-text-primary mb-2">Standard Capsule (100 Coins)</div>
                                <div className="grid grid-cols-2 gap-1 text-text-secondary font-mono">
                                    <div>Common: 60.0%</div>
                                    <div>Rare: 25.0%</div>
                                    <div>Epic: 12.0%</div>
                                    <div>Legendary: 3.0%</div>
                                </div>
                            </div>

                            <div className="p-3 bg-bg-primary rounded-xl border border-border/40">
                                <div className="font-bold text-text-primary mb-2">High Roller Capsule (500 Coins)</div>
                                <div className="grid grid-cols-2 gap-1 text-text-secondary font-mono">
                                    <div>Rare: 65.0%</div>
                                    <div>Epic: 27.0%</div>
                                    <div>Legendary: 8.0%</div>
                                </div>
                            </div>

                            <div className="p-3 bg-bg-primary rounded-xl border border-border/40">
                                <div className="font-bold text-text-primary mb-2">Heartbreak Pity Crate (3 Tokens)</div>
                                <div className="grid grid-cols-2 gap-1 text-text-secondary font-mono">
                                    <div>Epic: 75.0%</div>
                                    <div>Legendary: 25.0%</div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setRatesModalOpen(false)}
                            className="mt-6 w-full py-2 bg-text-primary text-bg-primary font-bold text-xs rounded-lg cursor-pointer hover:opacity-90"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

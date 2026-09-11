interface GradientSquare {
    id: string;
    gradient: string;
    animated?: boolean;
    duration?: string;
}

const ITEMS: GradientSquare[] = [
    // --- LOWKEY ANIMATED DRIFTING GRADIENTS ---
    { id: 'anim-1', gradient: 'linear-gradient(135deg, #ef4444, #f97316, #f59e0b, #ef4444)', animated: true, duration: '8s' },
    { id: 'anim-2', gradient: 'linear-gradient(135deg, #059669, #0d9488, #0284c7, #6366f1, #059669)', animated: true, duration: '10s' },
    { id: 'anim-3', gradient: 'linear-gradient(135deg, #4338ca, #7c3aed, #db2777, #4338ca)', animated: true, duration: '9s' },
    { id: 'anim-4', gradient: 'linear-gradient(135deg, #f72585, #7209b7, #3a0ca3, #4361ee, #f72585)', animated: true, duration: '11s' },
    { id: 'anim-5', gradient: 'linear-gradient(135deg, #ea580c, #f59e0b, #eab308, #84cc16, #ea580c)', animated: true, duration: '8.5s' },
    { id: 'anim-6', gradient: 'linear-gradient(135deg, #00c6ff, #0072ff, #38bdf8, #0284c7, #00c6ff)', animated: true, duration: '7.5s' },
    { id: 'anim-7', gradient: 'linear-gradient(135deg, #10b981, #06b6d4, #3b82f6, #10b981)', animated: true, duration: '9.5s' },
    { id: 'anim-8', gradient: 'linear-gradient(135deg, #fda4af, #f472b6, #fb7185, #f43f5e, #fda4af)', animated: true, duration: '8s' },
    { id: 'anim-9', gradient: 'linear-gradient(135deg, #991b1b, #dc2626, #ea580c, #f97316, #991b1b)', animated: true, duration: '7s' },
    { id: 'anim-10', gradient: 'linear-gradient(135deg, #312e81, #581c87, #831843, #4c1d95, #312e81)', animated: true, duration: '12s' },
    { id: 'anim-11', gradient: 'linear-gradient(135deg, #065f46, #10b981, #34d399, #6ee7b7, #065f46)', animated: true, duration: '10.5s' },
    { id: 'anim-12', gradient: 'linear-gradient(135deg, #0f172a, #1e293b, #334155, #1e1b4b, #0f172a)', animated: true, duration: '14s' },
    { id: 'anim-13', gradient: 'linear-gradient(135deg, #b45309, #f59e0b, #fef08a, #d97706, #b45309)', animated: true, duration: '9s' },
    { id: 'anim-14', gradient: 'linear-gradient(135deg, #fb7185, #f43f5e, #fda4af, #fed7aa, #fb7185)', animated: true, duration: '8.5s' },
    { id: 'anim-15', gradient: 'linear-gradient(135deg, #0f766e, #14b8a6, #2dd4bf, #0284c7, #0f766e)', animated: true, duration: '10s' },
    { id: 'anim-16', gradient: 'linear-gradient(135deg, #6b21a8, #9333ea, #c084fc, #e879f9, #6b21a8)', animated: true, duration: '9s' },
    { id: 'anim-17', gradient: 'linear-gradient(135deg, #15803d, #65a30d, #a3e635, #4ade80, #15803d)', animated: true, duration: '8s' },
    { id: 'anim-18', gradient: 'linear-gradient(135deg, #1e1b4b, #4a044e, #701a75, #1e1b4b)', animated: true, duration: '13s' },
    { id: 'anim-19', gradient: 'linear-gradient(135deg, #0284c7, #38bdf8, #bae6fd, #e0f2fe, #0284c7)', animated: true, duration: '9.5s' },
    { id: 'anim-20', gradient: 'linear-gradient(135deg, #b91c1c, #ef4444, #f97316, #fbbf24, #b91c1c)', animated: true, duration: '7.5s' },
    { id: 'anim-21', gradient: 'linear-gradient(135deg, #fbcfe8, #fed7aa, #fef08a, #bbf7d0, #bae6fd, #fbcfe8)', animated: true, duration: '11s' },
    { id: 'anim-22', gradient: 'linear-gradient(135deg, #022c22, #042f2e, #082f49, #0f172a, #022c22)', animated: true, duration: '15s' },
    { id: 'anim-23', gradient: 'linear-gradient(135deg, #881337, #be185d, #ec4899, #f43f5e, #881337)', animated: true, duration: '8.5s' },
    { id: 'anim-24', gradient: 'linear-gradient(135deg, #06b6d4, #10b981, #fbbf24, #f97316, #06b6d4)', animated: true, duration: '10s' },
    { id: 'anim-25', gradient: 'linear-gradient(135deg, #18181b, #27272a, #3f3f46, #52525b, #18181b)', animated: true, duration: '12s' },
    { id: 'anim-26', gradient: 'linear-gradient(135deg, #ec4899, #8b5cf6, #3b82f6, #06b6d4, #ec4899)', animated: true, duration: '9s' },
    { id: 'anim-27', gradient: 'linear-gradient(135deg, #78350f, #9a3412, #c2410c, #ca8a04, #78350f)', animated: true, duration: '11.5s' },
    { id: 'anim-28', gradient: 'linear-gradient(135deg, #f472b6, #c084fc, #60a5fa, #38bdf8, #f472b6)', animated: true, duration: '8s' },
    { id: 'anim-29', gradient: 'linear-gradient(135deg, #172554, #1e40af, #2563eb, #3b82f6, #172554)', animated: true, duration: '10.5s' },
    { id: 'anim-30', gradient: 'linear-gradient(135deg, #064e3b, #059669, #10b981, #4ade80, #064e3b)', animated: true, duration: '9s' },
    { id: 'anim-31', gradient: 'linear-gradient(135deg, #be123c, #fb7185, #f97316, #fde047, #be123c)', animated: true, duration: '8s' },
    { id: 'anim-32', gradient: 'linear-gradient(135deg, #312e81, #4c1d95, #6d28d9, #a78bfa, #312e81)', animated: true, duration: '10s' },

    // --- STATIC PURE GRADIENTS ---
    // Warm & Fiery
    { id: 'grad-1', gradient: 'linear-gradient(135deg, #ef4444, #f97316)' },
    { id: 'grad-2', gradient: 'linear-gradient(135deg, #f97316, #fbbf24)' },
    { id: 'grad-3', gradient: 'linear-gradient(135deg, #ea580c, #b91c1c)' },
    { id: 'grad-4', gradient: 'linear-gradient(135deg, #f43f5e, #ef4444)' },
    { id: 'grad-5', gradient: 'linear-gradient(135deg, #d97706, #fbbf24)' },
    { id: 'grad-6', gradient: 'linear-gradient(135deg, #ff416c, #ff4b2b)' },

    // Citrus & Greens
    { id: 'grad-7', gradient: 'linear-gradient(135deg, #a3e635, #22c55e)' },
    { id: 'grad-8', gradient: 'linear-gradient(135deg, #34d399, #059669)' },
    { id: 'grad-9', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
    { id: 'grad-10', gradient: 'linear-gradient(135deg, #84cc16, #10b981)' },
    { id: 'grad-11', gradient: 'linear-gradient(135deg, #065f46, #10b981)' },
    { id: 'grad-12', gradient: 'linear-gradient(135deg, #11998e, #38ef7d)' },

    // Cool Aquas & Blues
    { id: 'grad-13', gradient: 'linear-gradient(135deg, #06b6d4, #3b82f6)' },
    { id: 'grad-14', gradient: 'linear-gradient(135deg, #38bdf8, #6366f1)' },
    { id: 'grad-15', gradient: 'linear-gradient(135deg, #0284c7, #0f766e)' },
    { id: 'grad-16', gradient: 'linear-gradient(135deg, #00c6ff, #0072ff)' },
    { id: 'grad-17', gradient: 'linear-gradient(135deg, #2563eb, #1d4ed8)' },
    { id: 'grad-18', gradient: 'linear-gradient(135deg, #1cb5e0, #000046)' },

    // Purples & Indigos
    { id: 'grad-19', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
    { id: 'grad-20', gradient: 'linear-gradient(135deg, #8b5cf6, #ec4899)' },
    { id: 'grad-21', gradient: 'linear-gradient(135deg, #a855f7, #6366f1)' },
    { id: 'grad-22', gradient: 'linear-gradient(135deg, #7c3aed, #db2777)' },
    { id: 'grad-23', gradient: 'linear-gradient(135deg, #667eea, #764ba2)' },
    { id: 'grad-24', gradient: 'linear-gradient(135deg, #4a00e0, #8e2de2)' },

    // Pinks & Magentas
    { id: 'grad-25', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
    { id: 'grad-26', gradient: 'linear-gradient(135deg, #f472b6, #fb7185)' },
    { id: 'grad-27', gradient: 'linear-gradient(135deg, #f857a6, #ff5858)' },
    { id: 'grad-28', gradient: 'linear-gradient(135deg, #fa709a, #fee140)' },
    { id: 'grad-29', gradient: 'linear-gradient(135deg, #f72585, #7209b7)' },
    { id: 'grad-30', gradient: 'linear-gradient(135deg, #ee0979, #ff6a00)' },

    // Pastels & Soft Tones
    { id: 'grad-31', gradient: 'linear-gradient(135deg, #fbcfe8, #fed7aa)' },
    { id: 'grad-32', gradient: 'linear-gradient(135deg, #c4b5fd, #f5d0fe)' },
    { id: 'grad-33', gradient: 'linear-gradient(135deg, #bae6fd, #e0e7ff)' },
    { id: 'grad-34', gradient: 'linear-gradient(135deg, #bbf7d0, #a7f3d0)' },
    { id: 'grad-35', gradient: 'linear-gradient(135deg, #fad0c4, #ffd1ff)' },
    { id: 'grad-36', gradient: 'linear-gradient(135deg, #a1c4fd, #c2e9fb)' },

    // Sleek Dark & Monochromes
    { id: 'grad-37', gradient: 'linear-gradient(135deg, #27272a, #52525b)' },
    { id: 'grad-38', gradient: 'linear-gradient(135deg, #334155, #64748b)' },
    { id: 'grad-39', gradient: 'linear-gradient(135deg, #0f172a, #334155)' },
    { id: 'grad-40', gradient: 'linear-gradient(135deg, #1e1b4b, #4c1d95)' },
    { id: 'grad-41', gradient: 'linear-gradient(135deg, #082f49, #0f766e)' },
    { id: 'grad-42', gradient: 'linear-gradient(135deg, #8e9eab, #eef2f3)' },

    // Multi-stops & Radials
    { id: 'grad-43', gradient: 'linear-gradient(135deg, #00f260, #0575e6)' },
    { id: 'grad-44', gradient: 'linear-gradient(135deg, #f83600, #fe8c00)' },
    { id: 'grad-45', gradient: 'radial-gradient(circle at 30% 30%, #38bdf8, #1e3a8a)' },
    { id: 'grad-46', gradient: 'radial-gradient(circle at 30% 30%, #fb7185, #881337)' },
    { id: 'grad-47', gradient: 'radial-gradient(circle at 30% 30%, #4ade80, #064e3b)' },
    { id: 'grad-48', gradient: 'radial-gradient(circle at 30% 30%, #c084fc, #581c87)' },
];

export default function Store() {
    return (
        <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 pb-16">
            <style>{`
                @keyframes store-gradient-pan {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 sm:gap-6">
                {ITEMS.map((item) => (
                    <div
                        key={item.id}
                        className="w-full aspect-square min-w-0 rounded-2xl shadow-xs hover:scale-105 hover:shadow-md transition-all duration-200 cursor-pointer shrink-0 overflow-hidden relative"
                        style={{
                            background: item.gradient,
                            backgroundSize: item.animated ? '300% 300%' : undefined,
                            animation: item.animated ? `store-gradient-pan ${item.duration || '8s'} ease-in-out infinite` : undefined,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

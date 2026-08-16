import React, { useState } from 'react';

export interface Tab {
    id: string;
    label: string;
    content: React.ReactNode;
}

export interface TabsProps {
    tabs: Tab[];
    defaultTab?: string;
}

export default function Tabs({ tabs, defaultTab }: TabsProps) {
    const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex border-b border-border mb-4">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
              px-4 py-2 text-sm font-medium transition-colors relative
              ${activeTab === tab.id
                                ? 'text-accent'
                                : 'text-text-secondary hover:text-text-primary'
                            }
            `}
                    >
                        {tab.label}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-accent" />
                        )}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-auto">
                {tabs.find((t) => t.id === activeTab)?.content}
            </div>
        </div>
    );
}

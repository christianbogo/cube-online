const fs = require('fs');
let code = fs.readFileSync('src/components/records/RecordTable.tsx', 'utf8');

if (!code.includes('useIsMobile')) {
    code = code.replace(
        "import { useState, useEffect, useRef, useMemo } from 'react';",
        "import { useState, useEffect, useRef, useMemo } from 'react';\nimport { useIsMobile } from '../../utils/useIsMobile';"
    );
}

code = code.replace(
    'const { user } = useAuth();',
    'const { user } = useAuth();\n    const isMobile = useIsMobile();'
);

const mobileTableReplacement = `
                    {isMobile ? (
                        <table className="w-full text-sm text-left border-collapse select-none">
                            <thead>
                                <tr className="text-xs uppercase bg-bg-secondary text-text-secondary border-b border-border">
                                    <th className="px-4 py-3 font-semibold text-left whitespace-nowrap sticky left-0 bg-bg-secondary z-10">Metric</th>
                                    {rows.map(row => (
                                        <th key={row.type} className="px-3 py-3 font-semibold text-right whitespace-nowrap">{row.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                <tr className="hover:bg-bg-hover/40 transition-colors">
                                    <td className="px-4 py-2.5 font-semibold text-text-secondary text-xs uppercase sticky left-0 bg-bg-primary z-10 shadow-[1px_0_0_0_var(--color-border)]">Solves</td>
                                    {rows.map(row => (
                                        <td key={row.type} className="px-3 py-2.5 text-right text-text-primary font-mono text-xs">{row.count}</td>
                                    ))}
                                </tr>
                                <tr className="hover:bg-bg-hover/40 transition-colors">
                                    <td className="px-4 py-2.5 font-semibold text-text-secondary text-xs uppercase sticky left-0 bg-bg-primary z-10 shadow-[1px_0_0_0_var(--color-border)]">Mean</td>
                                    {rows.map(row => (
                                        <td key={row.type} className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs">{row.mean !== null ? formatTime(row.mean) : '-'}</td>
                                    ))}
                                </tr>
                                <tr className="hover:bg-bg-hover/40 transition-colors">
                                    <td className="px-4 py-2.5 font-semibold text-text-secondary text-xs uppercase sticky left-0 bg-bg-primary z-10 shadow-[1px_0_0_0_var(--color-border)]">Std</td>
                                    {rows.map(row => (
                                        <td key={row.type} className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs">{row.std !== null ? (row.std / 1000).toFixed(2) : '-'}</td>
                                    ))}
                                </tr>
                                <tr className="hover:bg-bg-hover/40 transition-colors">
                                    <td className="px-4 py-2.5 font-semibold text-text-secondary text-xs uppercase sticky left-0 bg-bg-primary z-10 shadow-[1px_0_0_0_var(--color-border)]">Time</td>
                                    {rows.map(row => (
                                        <td key={row.type} className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs whitespace-nowrap">{formatDuration(row.totalTime)}</td>
                                    ))}
                                </tr>
                                {[
                                    { label: 'Single', key: 'single' },
                                    { label: 'Ao5', key: 'ao5' },
                                    { label: 'Ao12', key: 'ao12' },
                                    { label: 'Ao50', key: 'ao50' },
                                    { label: 'Ao100', key: 'ao100' },
                                    { label: 'Ao250*', key: 'ao250' },
                                    { label: 'Ao1000*', key: 'ao1000' }
                                ].map(metric => (
                                    <tr key={metric.key} className="hover:bg-bg-hover/40 transition-colors">
                                        <td className="px-4 py-2.5 font-semibold text-text-secondary text-xs uppercase sticky left-0 bg-bg-primary z-10 shadow-[1px_0_0_0_var(--color-border)]">{metric.label}</td>
                                        {rows.map(row => (
                                            <RecordCell
                                                key={row.type}
                                                eventName={row.label}
                                                eventType={row.type}
                                                detail={row[metric.key]}
                                                isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === metric.key}
                                                onClick={handleRecordClick}
                                            />
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-sm text-left border-collapse select-none">
                            <thead>
                                <tr className="text-xs uppercase bg-bg-secondary text-text-secondary border-b border-border">
                                    <th className="px-4 py-3 font-semibold text-left whitespace-nowrap">Event</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Solves</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Mean</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Std</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Time</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Single</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Ao5</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Ao12</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Ao50</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap">Ao100</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap" title="Cross-session eligible">Ao250*</th>
                                    <th className="px-3 py-3 font-semibold text-right whitespace-nowrap" title="Cross-session eligible">Ao1000*</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {rows.map(row => (
                                    <tr key={row.type} className="hover:bg-bg-hover/40 transition-colors">
                                        <td className="px-4 py-2.5 font-semibold text-text-primary whitespace-nowrap">
                                            {row.label}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs">
                                            {row.count}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs">
                                            {row.mean !== null ? formatTime(row.mean) : '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs">
                                            {row.std !== null ? (row.std / 1000).toFixed(2) : '-'}
                                        </td>
                                        <td className="px-3 py-2.5 text-right text-text-secondary font-mono text-xs whitespace-nowrap">
                                            {formatDuration(row.totalTime)}
                                        </td>

                                        {/* Record Cells */}
                                        <RecordCell
                                            eventName={row.label}
                                            eventType={row.type}
                                            detail={row.single}
                                            isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'single'}
                                            onClick={handleRecordClick}
                                        />
                                        <RecordCell
                                            eventName={row.label}
                                            eventType={row.type}
                                            detail={row.ao5}
                                            isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao5'}
                                            onClick={handleRecordClick}
                                        />
                                        <RecordCell
                                            eventName={row.label}
                                            eventType={row.type}
                                            detail={row.ao12}
                                            isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao12'}
                                            onClick={handleRecordClick}
                                        />
                                        <RecordCell
                                            eventName={row.label}
                                            eventType={row.type}
                                            detail={row.ao50}
                                            isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao50'}
                                            onClick={handleRecordClick}
                                        />
                                        <RecordCell
                                            eventName={row.label}
                                            eventType={row.type}
                                            detail={row.ao100}
                                            isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao100'}
                                            onClick={handleRecordClick}
                                        />
                                        <RecordCell
                                            eventName={row.label}
                                            eventType={row.type}
                                            detail={row.ao250}
                                            isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao250'}
                                            onClick={handleRecordClick}
                                        />
                                        <RecordCell
                                            eventName={row.label}
                                            eventType={row.type}
                                            detail={row.ao1000}
                                            isSelected={selectedRecord?.eventType === row.type && selectedRecord.detail.type === 'ao1000'}
                                            onClick={handleRecordClick}
                                        />
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
`;

const desktopTableRegex = /<table className="w-full text-sm text-left border-collapse select-none">[\s\S]*?<\/table>/;
code = code.replace(desktopTableRegex, mobileTableReplacement.trim());

fs.writeFileSync('src/components/records/RecordTable.tsx', code);

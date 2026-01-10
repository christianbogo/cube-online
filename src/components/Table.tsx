import React from 'react';

interface Column<T> {
    header: React.ReactNode;
    accessor: keyof T | ((item: T, index: number) => React.ReactNode);
    className?: string;
    sortable?: boolean;
    key?: string; // Unique key for sorting
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
    onRowClick?: (item: T) => void;
    sortConfig?: { key: string; direction: 'asc' | 'desc' };
    onHeaderClick?: (key: string) => void;
    headerClassName?: string;
    rowClassName?: string;
    className?: string;
}

export default function Table<T extends { id: string | number }>({ data, columns, onRowClick, sortConfig, onHeaderClick, headerClassName, rowClassName, className }: TableProps<T>) {
    return (
        <div className={`w-full overflow-x-auto ${className || 'border border-border rounded-lg'}`}>
            <table className="w-full text-left text-sm border-collapse">
                <thead className={headerClassName || "bg-bg-hover"}>
                    <tr>
                        {columns.map((col, index) => (
                            <th
                                key={index}
                                className={`p-3 font-medium text-text-secondary border-b border-border ${col.className || ''} ${col.sortable ? 'cursor-pointer hover:text-text-primary select-none' : ''}`}
                                onClick={() => col.sortable && onHeaderClick?.(col.key || '')}
                            >
                                <div className="flex items-center gap-1">
                                    {col.header}
                                    {sortConfig && sortConfig.key === col.key && (
                                        <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {data.map((row, index) => (
                        <tr
                            key={row.id || index}
                            className={`hover:bg-bg-hover/50 transition-colors group ${rowClassName || ''} ${onRowClick ? 'cursor-pointer' : ''}`}
                            onClick={() => onRowClick?.(row)}
                        >
                            {columns.map((col, colIndex) => (
                                <td key={colIndex} className={`p-3 text-text-primary ${col.className || ''}`}>
                                    {typeof col.accessor === 'function'
                                        ? col.accessor(row, index)
                                        : (row[col.accessor] as React.ReactNode)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

import React from 'react';

interface Column<T> {
    header: React.ReactNode;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
}

interface TableProps<T> {
    data: T[];
    columns: Column<T>[];
}

export default function Table<T extends { id: string | number }>({ data, columns }: TableProps<T>) {
    return (
        <div className="w-full overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-bg-hover">
                    <tr>
                        {columns.map((col, index) => (
                            <th
                                key={index}
                                className={`p-3 font-medium text-text-secondary border-b border-border ${col.className || ''}`}
                            >
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {data.map((row) => (
                        <tr key={row.id} className="hover:bg-bg-hover/50 transition-colors">
                            {columns.map((col, colIndex) => (
                                <td key={colIndex} className={`p-3 text-text-primary ${col.className || ''}`}>
                                    {typeof col.accessor === 'function'
                                        ? col.accessor(row)
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

import re

with open('src/pages/Logs.tsx', 'r') as f:
    content = f.read()

content_split = content.split('{/* Hover Tooltip: Solid High-Z Popover with arrow */}')
first_part = content_split[0]
second_part = content_split[1]

replacement = """{/* Hover Tooltip: Solid High-Z Popover with arrow */}
                                {count > 0 ? (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:flex flex-col gap-1.5 bg-zinc-950 text-white text-[11px] px-3.5 py-2.5 rounded-lg border border-zinc-700 whitespace-nowrap z-[999] shadow-2xl pointer-events-none min-w-[120px]">
                                        <div className="font-semibold text-center border-b border-zinc-800 pb-1">
                                            {format(d, 'EEEE, MMM d, yyyy')}
                                        </div>
                                        <div className="flex flex-col gap-0.5 text-zinc-300 font-mono text-[10px]">
                                            <div className="flex justify-between items-center gap-3">
                                                <span className="text-zinc-400 font-sans">Solves:</span>
                                                <span className="font-bold text-white">{count}</span>
                                            </div>
                                        </div>
                                        <div className="w-2 h-2 bg-zinc-950 border-r border-b border-zinc-700 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                                    </div>
                                ) : (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:flex flex-col items-center bg-zinc-950 text-white text-[11px] px-3 py-1.5 rounded-md border border-zinc-700 whitespace-nowrap z-[999] shadow-2xl pointer-events-none">
                                        <span className="font-semibold">{format(d, 'EEEE, MMM d, yyyy')}</span>
                                        <span className="text-[10px] text-zinc-400 font-mono mt-0.5">0 solves</span>
                                        <div className="w-2 h-2 bg-zinc-950 border-r border-b border-zinc-700 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                                    </div>
                                )}
                            </div>
                        );
                    })}"""

end_split = second_part.split('                        );\n                    })}')
second_part_end = '                        );\n                    })}' + end_split[1]

new_content = first_part + replacement + second_part_end

with open('src/pages/Logs.tsx', 'w') as f:
    f.write(new_content)

import type { Solve } from '../types';
import { SUPPORTED_EVENT_IDS } from './constants';

export const CSTIMER_SCR_MAP: Record<string, string> = {
    // 3x3 variants
    '333': '333',
    '333oh': '333',
    '333ft': '333',
    '333fm': '333',
    // 2x2
    '222': '222',
    '222so': '222',
    '222o': '222',
    '222eg': '222',
    // 4x4
    '444': '444',
    '444wca': '444',
    '444m': '444',
    // 5x5
    '555': '555',
    '555wca': '555',
    // 6x6
    '666': '666',
    '666wca': '666',
    '666p': '666',
    '666s': '666',
    // 7x7
    '777': '777',
    '777wca': '777',
    '777p': '777',
    '777s': '777',
    // Clock
    'clock': 'clock',
    'clkwca': 'clock',
    'clk': 'clock',
    // Megaminx
    'minx': 'minx',
    'mgmp': 'minx',
    // Pyraminx
    'pyram': 'pyram',
    'pyrso': 'pyram',
    'pyr4m': 'pyram',
    'pyrnb': 'pyram',
    // Skewb
    'skewb': 'skewb',
    'skbso': 'skewb',
    'skbo': 'skewb',
    // Square-1
    'sq1': 'sq1',
    'sqrs': 'sq1',
    // Blindfolded
    '333bf': '333bf',
    '333ni': '333bf',
    '444bf': '444bf',
    '444bld': '444bf',
    '555bf': '555bf',
    '555bld': '555bf',
    '333mbf': '333mbf',
    'r3ni': '333mbf',
};

export interface ParsedCsTimerSolve {
    time: number; // in ms
    scramble: string;
    date: string; // ISO string
    penalty: 'none' | '+2' | 'DNF';
    scrambleType: string;
    source: 'cstimer';
    comment?: string;
}

export interface ParsedCsTimerSession {
    sessionKey: string; // e.g. "session1"
    sessionIndex: number;
    name: string; // e.g. "Session 1"
    scrambleType: string;
    solves: ParsedCsTimerSolve[];
    startDate?: string;
    endDate?: string;
}

export interface CsTimerParseResult {
    success: boolean;
    error?: string;
    sessions: ParsedCsTimerSession[];
    totalSolves: number;
}

/**
 * Maps a csTimer scramble type or session name to a supported event ID.
 */
export function mapCsTimerScrambleType(rawType?: string, sessionName?: string): string {
    if (rawType) {
        const lower = rawType.toLowerCase().trim();
        if (CSTIMER_SCR_MAP[lower]) {
            return CSTIMER_SCR_MAP[lower];
        }
        if (SUPPORTED_EVENT_IDS.includes(lower)) {
            return lower;
        }
        return rawType;
    }

    // Try inferring from session name if available
    if (sessionName) {
        const lowerName = sessionName.toLowerCase();
        if (lowerName.includes('2x2') || lowerName.includes('222')) return '222';
        if (lowerName.includes('4x4') || lowerName.includes('444')) return '444';
        if (lowerName.includes('5x5') || lowerName.includes('555')) return '555';
        if (lowerName.includes('6x6') || lowerName.includes('666')) return '666';
        if (lowerName.includes('7x7') || lowerName.includes('777')) return '777';
        if (lowerName.includes('clock') || lowerName.includes('clk')) return 'clock';
        if (lowerName.includes('mega') || lowerName.includes('minx')) return 'minx';
        if (lowerName.includes('pyra')) return 'pyram';
        if (lowerName.includes('skewb')) return 'skewb';
        if (lowerName.includes('sq1') || lowerName.includes('sq-1') || lowerName.includes('square')) return 'sq1';
        if (lowerName.includes('3bld') || lowerName.includes('bld')) return '333bf';
    }

    return '333';
}

/**
 * Safely parses raw text from a csTimer export file (.txt, .json, or .csv).
 */
export function parseCsTimerData(fileContent: string): CsTimerParseResult {
    const trimmed = fileContent.trim();
    if (!trimmed) {
        return { success: false, error: 'The provided file is empty.', sessions: [], totalSolves: 0 };
    }

    // Try JSON parsing first (standard csTimer full backup)
    if (trimmed.startsWith('{')) {
        try {
            return parseCsTimerJson(trimmed);
        } catch (e: any) {
            return {
                success: false,
                error: `Failed to parse csTimer JSON: ${e.message || 'Invalid format'}`,
                sessions: [],
                totalSolves: 0
            };
        }
    }

    // Try CSV parsing as fallback
    if (trimmed.includes(';') || trimmed.includes(',')) {
        try {
            return parseCsTimerCsv(trimmed);
        } catch (e: any) {
            return {
                success: false,
                error: `Failed to parse csTimer CSV: ${e.message || 'Invalid format'}`,
                sessions: [],
                totalSolves: 0
            };
        }
    }

    return {
        success: false,
        error: 'Unrecognized file format. Please upload a valid csTimer export file (.txt or .json).',
        sessions: [],
        totalSolves: 0
    };
}

/**
 * Safely parses any raw value into a valid millisecond Unix timestamp.
 * Handles seconds (e.g. 1712000000), milliseconds (1712000000000), numeric strings, and date strings.
 */
export function parseTimestampToMs(raw: any): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number') {
        if (isNaN(raw) || raw <= 0) return null;
        return raw < 1e11 ? Math.round(raw * 1000) : Math.round(raw);
    }
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return null;
        const num = Number(trimmed);
        if (!isNaN(num) && num > 0) {
            return num < 1e11 ? Math.round(num * 1000) : Math.round(num);
        }
        const d = new Date(trimmed);
        if (!isNaN(d.getTime()) && d.getTime() > 0) {
            return d.getTime();
        }
    }
    return null;
}

/**
 * Parses csTimer native JSON structure.
 */
function parseCsTimerJson(jsonString: string): CsTimerParseResult {
    const data = JSON.parse(jsonString);

    // Extract session metadata from properties.sessionData if present.
    // csTimer can store properties as a JSON string, and properties.sessionData as a JSON string.
    let propertiesObj: any = data.properties;
    if (typeof propertiesObj === 'string') {
        try {
            propertiesObj = JSON.parse(propertiesObj);
        } catch {
            propertiesObj = {};
        }
    }

    let sessionMetaMap: Record<string, any> = {};
    if (propertiesObj && propertiesObj.sessionData) {
        if (typeof propertiesObj.sessionData === 'string') {
            try {
                sessionMetaMap = JSON.parse(propertiesObj.sessionData);
            } catch {
                sessionMetaMap = {};
            }
        } else if (typeof propertiesObj.sessionData === 'object') {
            sessionMetaMap = propertiesObj.sessionData;
        }
    }

    const sessions: ParsedCsTimerSession[] = [];
    let totalSolves = 0;

    // csTimer sessions are keyed as "session1", "session2", etc.
    const sessionKeys = Object.keys(data)
        .filter(key => /^session\d+$/i.test(key))
        .sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
            const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
            return numA - numB;
        });

    for (const sessionKey of sessionKeys) {
        const rawSolves = data[sessionKey];
        if (!Array.isArray(rawSolves) || rawSolves.length === 0) {
            continue;
        }

        const sessionIndex = parseInt(sessionKey.replace(/\D/g, ''), 10) || 1;
        const meta = sessionMetaMap[String(sessionIndex)] || sessionMetaMap[sessionKey] || {};
        const sessionName = meta.name?.trim() || `Session ${sessionIndex}`;
        const rawScrType = meta.opt?.scrType;
        const scrambleType = mapCsTimerScrambleType(rawScrType, sessionName);

        // Extract session date bounds if available (csTimer date: [startTime, lastSolveTime])
        const sessionStartMs = Array.isArray(meta.date) ? parseTimestampToMs(meta.date[0]) : null;
        const sessionEndMs = Array.isArray(meta.date) ? parseTimestampToMs(meta.date[1]) : null;

        interface TempSolve {
            time: number;
            penalty: 'none' | '+2' | 'DNF';
            scramble: string;
            comment?: string;
            explicitTimestampMs: number | null;
        }

        const tempSolves: TempSolve[] = [];

        for (const rawSolve of rawSolves) {
            if (!Array.isArray(rawSolve) && typeof rawSolve !== 'object') continue;

            let timeMeta: any;
            let rawScramble: any = '';
            let rawComment = '';
            let explicitTimestampMs: number | null = null;

            if (Array.isArray(rawSolve)) {
                if (rawSolve.length < 2) continue;
                timeMeta = rawSolve[0];
                rawScramble = rawSolve[1];

                if (rawSolve.length >= 4) {
                    rawComment = typeof rawSolve[2] === 'string' ? rawSolve[2] : '';
                    explicitTimestampMs = parseTimestampToMs(rawSolve[3]);
                } else if (rawSolve.length === 3) {
                    // Could be [[p, t], scramble, comment] OR [[p, t], scramble, timestamp]
                    if (typeof rawSolve[2] === 'number') {
                        explicitTimestampMs = parseTimestampToMs(rawSolve[2]);
                    } else if (typeof rawSolve[2] === 'string') {
                        const str = rawSolve[2].trim();
                        if (/^\d{9,13}$/.test(str)) {
                            explicitTimestampMs = parseTimestampToMs(str);
                        } else {
                            rawComment = str;
                        }
                    }
                }
            } else {
                timeMeta = rawSolve.time ?? rawSolve.timeMeta;
                rawScramble = rawSolve.scramble ?? '';
                rawComment = rawSolve.comment ?? '';
                explicitTimestampMs = parseTimestampToMs(rawSolve.timestamp ?? rawSolve.date);
            }

            let penalty: 'none' | '+2' | 'DNF' = 'none';
            let time = 0;

            if (Array.isArray(timeMeta) && timeMeta.length >= 2) {
                const p = timeMeta[0];
                time = Math.max(0, Math.round(Number(timeMeta[1]) || 0));

                if (p === 2000) penalty = '+2';
                else if (p === -1) penalty = 'DNF';
                else penalty = 'none';

                if (!explicitTimestampMs && timeMeta.length >= 3) {
                    explicitTimestampMs = parseTimestampToMs(timeMeta[2]);
                }
            } else if (typeof timeMeta === 'number') {
                time = Math.max(0, Math.round(timeMeta));
            }

            // Skip invalid times
            if (time <= 0 && penalty !== 'DNF') continue;

            const scramble = typeof rawScramble === 'string' ? rawScramble.trim() : '';

            tempSolves.push({
                time,
                scramble,
                comment: rawComment || undefined,
                penalty,
                explicitTimestampMs
            });
        }

        if (tempSolves.length === 0) continue;

        // Resolve timestamps for each solve in the session (chronological order)
        const count = tempSolves.length;
        const resolvedTimestampsMs: number[] = new Array(count);
        const hasAllExplicit = tempSolves.every(s => s.explicitTimestampMs !== null);
        const hasAnyExplicit = tempSolves.some(s => s.explicitTimestampMs !== null);

        if (hasAllExplicit) {
            for (let i = 0; i < count; i++) {
                resolvedTimestampsMs[i] = tempSolves[i].explicitTimestampMs!;
            }
        } else if (hasAnyExplicit) {
            // Fill known timestamps
            for (let i = 0; i < count; i++) {
                if (tempSolves[i].explicitTimestampMs !== null) {
                    resolvedTimestampsMs[i] = tempSolves[i].explicitTimestampMs!;
                }
            }
            // Interpolate missing timestamps
            for (let i = 0; i < count; i++) {
                if (resolvedTimestampsMs[i] === undefined) {
                    let prevIdx = -1;
                    for (let j = i - 1; j >= 0; j--) {
                        if (resolvedTimestampsMs[j] !== undefined) { prevIdx = j; break; }
                    }
                    let nextIdx = -1;
                    for (let j = i + 1; j < count; j++) {
                        if (resolvedTimestampsMs[j] !== undefined) { nextIdx = j; break; }
                    }

                    if (prevIdx !== -1 && nextIdx !== -1) {
                        const span = nextIdx - prevIdx;
                        const diff = resolvedTimestampsMs[nextIdx] - resolvedTimestampsMs[prevIdx];
                        resolvedTimestampsMs[i] = Math.round(resolvedTimestampsMs[prevIdx] + diff * ((i - prevIdx) / span));
                    } else if (prevIdx !== -1) {
                        resolvedTimestampsMs[i] = resolvedTimestampsMs[prevIdx] + (tempSolves[i].time || 30000) + 15000;
                    } else if (nextIdx !== -1) {
                        resolvedTimestampsMs[i] = resolvedTimestampsMs[nextIdx] - ((tempSolves[i].time || 30000) + 15000);
                    }
                }
            }
        } else if (sessionStartMs !== null || sessionEndMs !== null) {
            // No per-solve timestamps, but session start/end is in sessionData
            const start = sessionStartMs ?? sessionEndMs!;
            const end = sessionEndMs ?? sessionStartMs!;
            const minTs = Math.min(start, end);
            const maxTs = Math.max(start, end);

            if (count === 1) {
                resolvedTimestampsMs[0] = minTs;
            } else if (maxTs > minTs) {
                for (let i = 0; i < count; i++) {
                    resolvedTimestampsMs[i] = Math.round(minTs + (maxTs - minTs) * (i / (count - 1)));
                }
            } else {
                let current = minTs;
                for (let i = 0; i < count; i++) {
                    resolvedTimestampsMs[i] = current;
                    current += (tempSolves[i].time || 30000) + 15000;
                }
            }
        } else {
            // Neither per-solve timestamps nor session metadata dates exist.
            // Space solves backwards chronologically ending 1 hour ago so they don't land on "now"
            // and never crowd into the 24-hour leaderboard window.
            const baseEnd = Date.now() - 3600000;
            resolvedTimestampsMs[count - 1] = baseEnd;
            for (let i = count - 2; i >= 0; i--) {
                const duration = (tempSolves[i].time > 0 ? tempSolves[i].time : 30000) + 20000;
                resolvedTimestampsMs[i] = resolvedTimestampsMs[i + 1] - duration;
            }
        }

        const parsedSolves: ParsedCsTimerSolve[] = tempSolves.map((s, idx) => ({
            time: s.time,
            scramble: s.scramble,
            date: new Date(resolvedTimestampsMs[idx]).toISOString(),
            penalty: s.penalty,
            scrambleType,
            source: 'cstimer',
            comment: s.comment
        }));

        if (parsedSolves.length > 0) {
            // Sort solves newest first
            parsedSolves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            sessions.push({
                sessionKey,
                sessionIndex,
                name: sessionName,
                scrambleType,
                solves: parsedSolves,
                startDate: parsedSolves[parsedSolves.length - 1].date,
                endDate: parsedSolves[0].date
            });
            totalSolves += parsedSolves.length;
        }
    }

    if (sessions.length === 0) {
        return {
            success: false,
            error: 'No valid sessions or solves found in this csTimer file.',
            sessions: [],
            totalSolves: 0
        };
    }

    return {
        success: true,
        sessions,
        totalSolves
    };
}

/**
 * Parses csTimer CSV export as a fallback.
 */
function parseCsTimerCsv(csvString: string): CsTimerParseResult {
    const lines = csvString.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) {
        return { success: false, error: 'CSV file contains no solve rows.', sessions: [], totalSolves: 0 };
    }

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const header = lines[0].split(delimiter).map(h => h.trim().toLowerCase());

    const timeCol = header.findIndex(h => h === 'time' || h.startsWith('time(') || h === 'total' || h === 'result' || h.includes('time'));
    const scrambleCol = header.findIndex(h => h === 'scramble' || h.includes('scramble'));
    const dateCol = header.findIndex(h => h === 'date' || h.startsWith('date(') || h === 'timestamp' || h === 'datetime' || h.includes('date'));
    const commentCol = header.findIndex(h => h === 'comment' || h.includes('comment'));
    const puzzleCol = header.findIndex(h => h === 'puzzle' || h === 'category' || h === 'event');

    if (timeCol === -1 || scrambleCol === -1) {
        return { success: false, error: 'CSV missing required "Time" or "Scramble" headers.', sessions: [], totalSolves: 0 };
    }

    interface TempCsvSolve {
        time: number;
        scramble: string;
        penalty: 'none' | '+2' | 'DNF';
        comment?: string;
        scrambleType: string;
        explicitTimestampMs: number | null;
    }

    const tempSolves: TempCsvSolve[] = [];

    for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map(p => p.trim());
        if (parts.length <= Math.max(timeCol, scrambleCol)) continue;

        const timeStr = parts[timeCol];
        const scramble = parts[scrambleCol] || '';
        const comment = commentCol !== -1 ? parts[commentCol] : undefined;
        const dateStr = dateCol !== -1 ? parts[dateCol] : undefined;
        const puzzleStr = puzzleCol !== -1 ? parts[puzzleCol] : undefined;
        const scrambleType = mapCsTimerScrambleType(puzzleStr);

        let penalty: 'none' | '+2' | 'DNF' = 'none';
        let timeInMs = 0;

        if (timeStr.toUpperCase().startsWith('DNF')) {
            penalty = 'DNF';
            const inner = timeStr.match(/\(([^)]+)\)/);
            if (inner) {
                timeInMs = parseSecondsToMs(inner[1]);
            }
        } else if (timeStr.endsWith('+')) {
            penalty = '+2';
            timeInMs = parseSecondsToMs(timeStr.slice(0, -1));
        } else {
            timeInMs = parseSecondsToMs(timeStr);
        }

        if (timeInMs <= 0 && penalty !== 'DNF') continue;

        const explicitTimestampMs = dateStr ? parseTimestampToMs(dateStr) : null;

        tempSolves.push({
            time: timeInMs,
            scramble,
            penalty,
            scrambleType,
            comment: comment || undefined,
            explicitTimestampMs
        });
    }

    if (tempSolves.length === 0) {
        return { success: false, error: 'No valid solves could be parsed from the CSV.', sessions: [], totalSolves: 0 };
    }

    const count = tempSolves.length;
    const resolvedTimestampsMs: number[] = new Array(count);
    const hasAllExplicit = tempSolves.every(s => s.explicitTimestampMs !== null);
    const hasAnyExplicit = tempSolves.some(s => s.explicitTimestampMs !== null);

    if (hasAllExplicit) {
        for (let i = 0; i < count; i++) {
            resolvedTimestampsMs[i] = tempSolves[i].explicitTimestampMs!;
        }
    } else if (hasAnyExplicit) {
        for (let i = 0; i < count; i++) {
            if (tempSolves[i].explicitTimestampMs !== null) {
                resolvedTimestampsMs[i] = tempSolves[i].explicitTimestampMs!;
            }
        }
        for (let i = 0; i < count; i++) {
            if (resolvedTimestampsMs[i] === undefined) {
                let prevIdx = -1;
                for (let j = i - 1; j >= 0; j--) {
                    if (resolvedTimestampsMs[j] !== undefined) { prevIdx = j; break; }
                }
                let nextIdx = -1;
                for (let j = i + 1; j < count; j++) {
                    if (resolvedTimestampsMs[j] !== undefined) { nextIdx = j; break; }
                }

                if (prevIdx !== -1 && nextIdx !== -1) {
                    const span = nextIdx - prevIdx;
                    const diff = resolvedTimestampsMs[nextIdx] - resolvedTimestampsMs[prevIdx];
                    resolvedTimestampsMs[i] = Math.round(resolvedTimestampsMs[prevIdx] + diff * ((i - prevIdx) / span));
                } else if (prevIdx !== -1) {
                    resolvedTimestampsMs[i] = resolvedTimestampsMs[prevIdx] + (tempSolves[i].time || 30000) + 15000;
                } else if (nextIdx !== -1) {
                    resolvedTimestampsMs[i] = resolvedTimestampsMs[nextIdx] - ((tempSolves[i].time || 30000) + 15000);
                }
            }
        }
    } else {
        const baseEnd = Date.now() - 3600000;
        resolvedTimestampsMs[count - 1] = baseEnd;
        for (let i = count - 2; i >= 0; i--) {
            const duration = (tempSolves[i].time > 0 ? tempSolves[i].time : 30000) + 20000;
            resolvedTimestampsMs[i] = resolvedTimestampsMs[i + 1] - duration;
        }
    }

    const solves: ParsedCsTimerSolve[] = tempSolves.map((s, idx) => ({
        time: s.time,
        scramble: s.scramble,
        date: new Date(resolvedTimestampsMs[idx]).toISOString(),
        penalty: s.penalty,
        scrambleType: s.scrambleType,
        source: 'cstimer',
        comment: s.comment
    }));

    solves.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const session: ParsedCsTimerSession = {
        sessionKey: 'session1',
        sessionIndex: 1,
        name: 'Imported CSV Session',
        scrambleType: solves[0]?.scrambleType || '333',
        solves,
        startDate: solves[solves.length - 1].date,
        endDate: solves[0].date
    };

    return {
        success: true,
        sessions: [session],
        totalSolves: solves.length
    };
}

function parseSecondsToMs(str: string): number {
    const clean = str.trim();
    if (!clean) return 0;

    // Handle min:sec format (e.g. 1:12.34)
    if (clean.includes(':')) {
        const [mins, secs] = clean.split(':');
        const m = parseFloat(mins) || 0;
        const s = parseFloat(secs) || 0;
        return Math.round((m * 60 + s) * 1000);
    }

    const s = parseFloat(clean);
    return isNaN(s) ? 0 : Math.round(s * 1000);
}

/**
 * Converts a ParsedCsTimerSession into full Solve instances.
 */
export function createSolvesFromCsTimerSession(
    parsedSession: ParsedCsTimerSession,
    options: {
        userId?: string;
        sessionId?: string;
        anomalyApproved?: boolean;
    } = {}
): Solve[] {
    const sid = options.sessionId || `cstimer_${parsedSession.sessionKey}_${Date.now()}`;
    const anomalyApproved = options.anomalyApproved ?? true;

    return parsedSession.solves.map(s => ({
        id: crypto.randomUUID(),
        userId: options.userId,
        sessionId: sid,
        time: s.time,
        scramble: s.scramble,
        date: s.date,
        penalty: s.penalty,
        inspectionPenalty: 'none',
        scrambleType: s.scrambleType,
        anomalyApproved,
        source: 'cstimer'
    }));
}

export interface ScrambleTypeOption {
    label: string;
    value: string;
    description?: string;
    isAverageable?: boolean;
}

export const SCRAMBLE_TYPES: ScrambleTypeOption[] = [
    { label: '3x3', value: '333', isAverageable: true },
    { label: '2x2', value: '222', isAverageable: true },
    { label: '4x4', value: '444', isAverageable: true },
    { label: '5x5', value: '555', isAverageable: true },
    { label: '6x6', value: '666', isAverageable: true },
    { label: '7x7', value: '777', isAverageable: true },
    { label: 'Clock', value: 'clock', isAverageable: true },
    { label: 'Mega', value: 'minx', isAverageable: true },
    { label: 'Pyra', value: 'pyram', isAverageable: true },
    { label: 'Skewb', value: 'skewb', isAverageable: true },
    { label: 'Sq-1', value: 'sq1', isAverageable: true },
    { label: '3BLD', value: '333bf', isAverageable: false },
    { label: '4BLD', value: '444bf', isAverageable: false },
    { label: '5BLD', value: '555bf', isAverageable: false },
    { label: 'MBLD', value: '333mbf', isAverageable: false },
];

export const SUPPORTED_EVENT_IDS = SCRAMBLE_TYPES.map(e => e.value);

export const AVERAGEABLE_EVENT_IDS = SCRAMBLE_TYPES.filter(e => e.isAverageable).map(e => e.value);

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatTime = void 0;
const formatTime = (ms) => {
    const totalSeconds = ms / 1000;
    if (totalSeconds < 60) {
        return totalSeconds.toFixed(2);
    }
    else {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = (totalSeconds % 60).toFixed(2);
        // Ensure seconds part has leading zero if needed (e.g. 1:05.43)
        return `${minutes}:${seconds.padStart(5, '0')}`;
    }
};
exports.formatTime = formatTime;
//# sourceMappingURL=formatTime.js.map
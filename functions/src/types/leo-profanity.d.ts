declare module 'leo-profanity' {
    export function check(text: string): boolean;
    export function clean(text: string): string;
    export function add(words: string[]): void;
    export function remove(words: string[]): void;
    export function reset(): void;
    export function clearList(): void;
    export function list(): string[];
    export function loadDictionary(lang?: string): void;
}

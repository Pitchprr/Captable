import { useEffect, useCallback, useRef, useState } from 'react';
import LZString from 'lz-string';
import type { CapTable, LiquidationPreference, CarveOutBeneficiary } from '../engine/types';

interface PersistedState {
    capTable: CapTable;
    preferences: LiquidationPreference[];
    carveOutPercent: number;
    carveOutBeneficiary: CarveOutBeneficiary;
    exitValuation: number;
}

const LOCALSTORAGE_KEY = 'captable-autosave';
const AUTOSAVE_DELAY = 3000; // 3 seconds

export const useCapTablePersistence = (
    state: PersistedState,
    onStateLoad: (state: PersistedState | null) => void
) => {
    const autoSaveTimerRef = useRef<number | null>(null);
    const hasLoadedFromUrlRef = useRef(false);
    const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
    const [shouldUpdateUrl, setShouldUpdateUrl] = useState(false);

    // Compress and encode state for URL
    const encodeStateToUrl = useCallback((state: PersistedState): string => {
        try {
            const json = JSON.stringify(state);
            const compressed = LZString.compressToEncodedURIComponent(json);
            return compressed;
        } catch (error) {
            console.error('Failed to encode state:', error);
            return '';
        }
    }, []);

    // Decode and decompress state from URL
    const decodeStateFromUrl = useCallback((encoded: string): PersistedState | null => {
        try {
            const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
            if (!decompressed) return null;
            return JSON.parse(decompressed);
        } catch (error) {
            console.error('Failed to decode state:', error);
            return null;
        }
    }, []);

    // Save to localStorage
    const saveToLocalStorage = useCallback((state: PersistedState) => {
        try {
            const json = JSON.stringify(state);
            localStorage.setItem(LOCALSTORAGE_KEY, json);
            setLastSaveTime(new Date());
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }, []);

    // Load from localStorage
    const loadFromLocalStorage = useCallback((): PersistedState | null => {
        try {
            const json = localStorage.getItem(LOCALSTORAGE_KEY);
            if (!json) return null;
            return JSON.parse(json);
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return null;
        }
    }, []);

    // Generate shareable URL
    const generateShareUrl = useCallback((): string => {
        const encoded = encodeStateToUrl(state);
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}#data=${encoded}`;
    }, [state, encodeStateToUrl]);

    // Copy share URL to clipboard
    const copyShareUrl = useCallback(async (): Promise<boolean> => {
        try {
            const url = generateShareUrl();
            await navigator.clipboard.writeText(url);
            // Enable auto-update of URL hash from now on
            setShouldUpdateUrl(true);
            // Also immediately update the URL
            const encoded = encodeStateToUrl(state);
            window.history.replaceState(null, '', `#data=${encoded}`);
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }, [generateShareUrl, encodeStateToUrl, state]);

    // Load state on mount (from URL or localStorage)
    useEffect(() => {
        if (hasLoadedFromUrlRef.current) return;
        hasLoadedFromUrlRef.current = true;

        let loadedState: PersistedState | null = null;

        // Check URL hash first
        const hash = window.location.hash;
        if (hash.startsWith('#data=')) {
            const encoded = hash.substring(6); // Remove '#data='
            loadedState = decodeStateFromUrl(encoded);

            if (loadedState) {
                console.log('Loaded state from URL');
                // Enable auto-update since we loaded from URL
                setShouldUpdateUrl(true);
            }
        }

        // Fallback to localStorage if no URL data
        if (!loadedState) {
            loadedState = loadFromLocalStorage();
            if (loadedState) {
                console.log('Loaded state from localStorage');
            }
        }

        // Always call onStateLoad to signal loading completion
        onStateLoad(loadedState);
    }, [decodeStateFromUrl, loadFromLocalStorage, onStateLoad]);

    // Auto-save to localStorage with debounce
    useEffect(() => {
        // Clear existing timer
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        // Set new timer
        autoSaveTimerRef.current = setTimeout(() => {
            saveToLocalStorage(state);

            // Update URL hash if enabled (after first share or loaded from URL)
            if (shouldUpdateUrl) {
                const encoded = encodeStateToUrl(state);
                window.history.replaceState(null, '', `#data=${encoded}`);
            }
        }, AUTOSAVE_DELAY);

        // Cleanup
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [state, saveToLocalStorage, encodeStateToUrl, shouldUpdateUrl]);

    return {
        generateShareUrl,
        copyShareUrl,
        saveToLocalStorage: () => saveToLocalStorage(state),
        lastSaveTime,
    };
};

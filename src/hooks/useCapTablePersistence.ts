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

export const useCapTablePersistence = (
    state: PersistedState,
    onStateLoad: (state: PersistedState | null) => void
) => {
    const hasLoadedFromUrlRef = useRef(false);
    const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

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

    // Generate shareable URL and update browser URL
    const generateAndUpdateShareUrl = useCallback((): string => {
        const encoded = encodeStateToUrl(state);
        const baseUrl = window.location.origin + window.location.pathname;
        const fullUrl = `${baseUrl}#data=${encoded}`;

        // Update browser URL immediately
        window.history.replaceState(null, '', `#data=${encoded}`);

        return fullUrl;
    }, [state, encodeStateToUrl]);

    // Copy share URL to clipboard
    const copyShareUrl = useCallback(async (): Promise<boolean> => {
        try {
            const url = generateAndUpdateShareUrl();
            await navigator.clipboard.writeText(url);
            return true;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }, [generateAndUpdateShareUrl]);

    // Load state on mount (from URL only)
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
            }
        }

        // Only load from localStorage if explicitly requested (restored via button) or if we decide to keep it manual.
        // User requested NO auto-load from localStorage on "classic URL".
        // So we do NOTHING if no URL hash.

        // Always call onStateLoad to signal loading completion
        onStateLoad(loadedState);
    }, [decodeStateFromUrl, onStateLoad]);

    // Manual save function
    const save = useCallback(() => {
        saveToLocalStorage(state);
    }, [state, saveToLocalStorage]);

    return {
        copyShareUrl,
        save,
        lastSaveTime,
    };
};

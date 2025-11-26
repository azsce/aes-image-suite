/**
 * Main application store using Zustand with persistence
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppStore,
  EncryptionMethod,
  ActiveTab,
  ComparisonResult,
  PersistedState,
  EncryptionState,
  DecryptionState,
  ComparisonState,
} from "@/types/store.types";
import type { ImageMetadata } from "@/types/crypto.types";
import { logger } from "@/utils/logger";
import { generateKey } from "@/utils/hexUtils";

/**
 * Initial state for encryption mode
 * Auto-generates key on initialization
 */
const initialEncryptionState: EncryptionState = {
  method: "ECB",
  keySize: 256,
  key: generateKey(256), // Auto-generate key on init
  originalImage: null,
  originalBits: null,
  metadata: null,
  isProcessing: false,
  error: null,
  encryptionMethod: "whole-file",
  currentCache: null,
};

/**
 * Initial state for decryption mode
 */
const initialDecryptionState: DecryptionState = {
  method: "ECB",
  keySize: 256,
  key: "",
  iv: "",
  encryptedImage: null,
  encryptedBits: null,
  metadata: null,
  isProcessing: false,
  error: null,
  currentCache: null,
};

/**
 * Initial state for comparison mode
 */
const initialComparisonState: ComparisonState = {
  imageA: null,
  imageB: null,
  isProcessing: false,
  result: null,
  error: null,
};

/**
 * Main application store with persistence
 */
export const useAppStore = create<AppStore>()(
  persist(
    set => ({
      // Global state
      activeTab: "encryption" as ActiveTab,
      theme: "light" as "light" | "dark",

      // Mode states
      encryption: initialEncryptionState,
      decryption: initialDecryptionState,
      comparison: initialComparisonState,

      // Global actions
      setActiveTab: (tab: ActiveTab) => {
        set({ activeTab: tab });
      },

      setTheme: (theme: "light" | "dark") => {
        set({ theme });
      },

      // Encryption actions
      setEncryptionMethod: (method: EncryptionMethod) => {
        set(state => ({
          encryption: {
            ...state.encryption,
            method,
          },
        }));
      },

      setEncryptionKeySize: (keySize: 128 | 192 | 256) => {
        set(state => ({
          encryption: {
            ...state.encryption,
            keySize,
            key: generateKey(keySize), // Auto-regenerate key with new size
            currentCache: null, // Clear cache when key changes
          },
        }));
      },

      setEncryptionKey: (key: string) => {
        set(state => ({
          encryption: {
            ...state.encryption,
            key,
            currentCache: null, // Clear cache when key changes
          },
        }));
      },

      setOriginalImage: (image: string | null) => {
        set(state => ({
          encryption: {
            ...state.encryption,
            originalImage: image,
          },
        }));
      },

      setOriginalBits: (bits: Uint8Array | null) => {
        set(state => ({
          encryption: {
            ...state.encryption,
            originalBits: bits,
            currentCache: null, // Clear cache when image changes
          },
        }));
      },

      setEncryptionMetadata: (metadata: ImageMetadata | null) => {
        set(state => ({
          encryption: {
            ...state.encryption,
            metadata,
          },
        }));
      },

      setEncryptionProcessing: (isProcessing: boolean) => {
        set(state => ({
          encryption: {
            ...state.encryption,
            isProcessing,
          },
        }));
      },

      setEncryptionError: (error: string | null) => {
        set(state => ({
          encryption: {
            ...state.encryption,
            error,
          },
        }));
      },

      resetEncryption: () => {
        set({ encryption: initialEncryptionState });
      },

      setFileEncryptionMethod: method => {
        set(state => ({
          encryption: {
            ...state.encryption,
            encryptionMethod: method,
          },
        }));
      },

      setEncryptionCache: cache => {
        set(state => ({
          encryption: {
            ...state.encryption,
            currentCache: cache,
          },
        }));
      },

      updateEncryptionCacheResult: (method, approach, result) => {
        set(state => {
          const currentCache = state.encryption.currentCache;

          if (!currentCache) {
            // Should not happen - cache should be initialized before updating
            logger.log("[Store] Cannot update cache - no cache exists");
            return state;
          }

          logger.log("[Store] Updating cache result", {
            method,
            approach,
            cacheKey: currentCache.cacheKey,
            url: result.encryptedImage,
          });

          // Create a deep copy of the cache
          const updatedCache = {
            ...currentCache,
            results: {
              ...currentCache.results,
              [method]: {
                ...currentCache.results[method],
                [approach]: result,
              },
            },
          };

          logger.log("[Store] Cache updated", {
            cacheKey: updatedCache.cacheKey,
            resultCount: Object.keys(updatedCache.results).length,
          });

          return {
            encryption: {
              ...state.encryption,
              currentCache: updatedCache,
            },
          };
        });
      },

      setCurrentIV: (iv: string) => {
        set(state => {
          const currentCache = state.encryption.currentCache;

          // If no cache exists yet (before image upload), create a temporary one
          if (!currentCache) {
            logger.log("[Store] Creating temporary cache for IV");
            return {
              encryption: {
                ...state.encryption,
                currentCache: {
                  cacheKey: "", // Will be set when image is uploaded
                  iv,
                  results: {},
                },
              },
            };
          }

          return {
            encryption: {
              ...state.encryption,
              currentCache: {
                ...currentCache,
                iv,
              },
            },
          };
        });
      },

      // Decryption actions
      setDecryptionMethod: (method: EncryptionMethod) => {
        set(state => ({
          decryption: {
            ...state.decryption,
            method,
          },
        }));
      },

      setDecryptionKeySize: (keySize: 128 | 192 | 256) => {
        set(state => ({
          decryption: {
            ...state.decryption,
            keySize,
          },
        }));
      },

      setDecryptionKey: (key: string) => {
        set(state => ({
          decryption: {
            ...state.decryption,
            key,
            currentCache: null, // Clear cache when key changes
          },
        }));
      },

      setDecryptionIV: (iv: string) => {
        set(state => ({
          decryption: {
            ...state.decryption,
            iv,
            currentCache: null, // Clear cache when IV changes
          },
        }));
      },

      setEncryptedImageForDecryption: (image: string | null) => {
        set(state => ({
          decryption: {
            ...state.decryption,
            encryptedImage: image,
          },
        }));
      },

      setEncryptedBitsForDecryption: (bits: Uint8Array | null) => {
        set(state => ({
          decryption: {
            ...state.decryption,
            encryptedBits: bits,
            currentCache: null, // Clear cache when encrypted image changes
          },
        }));
      },

      setDecryptionMetadata: (metadata: ImageMetadata | null) => {
        set(state => ({
          decryption: {
            ...state.decryption,
            metadata,
          },
        }));
      },

      setDecryptionProcessing: (isProcessing: boolean) => {
        set(state => ({
          decryption: {
            ...state.decryption,
            isProcessing,
          },
        }));
      },

      setDecryptionError: (error: string | null) => {
        set(state => ({
          decryption: {
            ...state.decryption,
            error,
          },
        }));
      },

      resetDecryption: () => {
        set({ decryption: initialDecryptionState });
      },

      setDecryptionCache: cache => {
        set(state => ({
          decryption: {
            ...state.decryption,
            currentCache: cache,
          },
        }));
      },

      updateDecryptionCacheResult: (method, result) => {
        set(state => {
          const currentCache = state.decryption.currentCache;

          if (!currentCache) {
            // Should not happen - cache should be initialized before updating
            logger.log("[Store] Cannot update decryption cache - no cache exists");
            return state;
          }

          logger.log("[Store] Updating decryption cache result", {
            method,
            cacheKey: currentCache.cacheKey,
            url: result.decryptedImage,
          });

          // Create a deep copy of the cache
          const updatedCache = {
            ...currentCache,
            results: {
              ...currentCache.results,
              [method]: result,
            },
          };

          logger.log("[Store] Decryption cache updated", {
            cacheKey: updatedCache.cacheKey,
            resultCount: Object.keys(updatedCache.results).length,
          });

          return {
            decryption: {
              ...state.decryption,
              currentCache: updatedCache,
            },
          };
        });
      },

      updateDecryptionCacheComparison: (method, comparison) => {
        set(state => {
          const currentCache = state.decryption.currentCache;

          if (!currentCache) {
            logger.log("[Store] Cannot update decryption cache comparison - no cache exists");
            return state;
          }

          // Handle clearing comparison result
          if (comparison === null) {
            logger.log("[Store] Clearing decryption cache comparison", {
              method,
              cacheKey: currentCache.cacheKey,
            });

            const { [method]: _, ...remainingComparisons } = currentCache.comparisons;

            return {
              decryption: {
                ...state.decryption,
                currentCache: {
                  ...currentCache,
                  comparisons: remainingComparisons,
                },
              },
            };
          }

          logger.log("[Store] Updating decryption cache comparison", {
            method,
            cacheKey: currentCache.cacheKey,
            comparisonImageHash: comparison.comparisonImageHash,
            identical: comparison.result.identical,
          });

          const updatedCache = {
            ...currentCache,
            comparisons: {
              ...currentCache.comparisons,
              [method]: comparison,
            },
          };

          logger.log("[Store] Decryption cache comparison updated", {
            cacheKey: updatedCache.cacheKey,
            comparisonCount: Object.keys(updatedCache.comparisons).length,
          });

          return {
            decryption: {
              ...state.decryption,
              currentCache: updatedCache,
            },
          };
        });
      },

      // Comparison actions
      setComparisonImageA: (image: string | null) => {
        set(state => ({
          comparison: {
            ...state.comparison,
            imageA: image,
          },
        }));
      },

      setComparisonImageB: (image: string | null) => {
        set(state => ({
          comparison: {
            ...state.comparison,
            imageB: image,
          },
        }));
      },

      setComparisonProcessing: (isProcessing: boolean) => {
        set(state => ({
          comparison: {
            ...state.comparison,
            isProcessing,
          },
        }));
      },

      setComparisonResult: (result: ComparisonResult | null) => {
        set(state => ({
          comparison: {
            ...state.comparison,
            result,
          },
        }));
      },

      setComparisonError: (error: string | null) => {
        set(state => ({
          comparison: {
            ...state.comparison,
            error,
          },
        }));
      },

      resetComparison: () => {
        set({ comparison: initialComparisonState });
      },
    }),
    {
      name: "aes-encryption-suite",
      partialize: (state): PersistedState => ({
        activeTab: state.activeTab,
        theme: state.theme,
        encryption: {
          method: state.encryption.method,
          keySize: state.encryption.keySize,
          metadata: state.encryption.metadata,
          encryptionMethod: state.encryption.encryptionMethod,
        },
        decryption: {
          method: state.decryption.method,
          keySize: state.decryption.keySize,
          metadata: state.decryption.metadata,
        },
      }),
      merge: (persistedState, currentState) => {
        // Merge persisted state with current state
        // Ensure key is preserved from initial state if not in persisted state
        const merged = {
          ...currentState,
          ...(persistedState as Partial<AppStore>),
          encryption: {
            ...currentState.encryption,
            ...(persistedState as Partial<AppStore>).encryption,
            // Preserve auto-generated key from initial state
            key: currentState.encryption.key,
          },
          decryption: {
            ...currentState.decryption,
            ...(persistedState as Partial<AppStore>).decryption,
          },
        };
        logger.log("[Store] Hydrated from localStorage with auto-generated key", {
          keyLength: merged.encryption.key.length,
        });
        return merged;
      },
    }
  )
);

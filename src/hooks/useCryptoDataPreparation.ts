import { useCallback } from "react";
import { hexToBytes } from "@/utils/hexUtils";
import type { ExtendedCryptoState } from "./useCryptoState";

/**
 * Custom hook for preparing crypto operation data
 *
 * Converts hex strings to byte arrays and selects the appropriate
 * source data (original or encrypted) based on operation type.
 *
 * @param state - Current crypto state containing keys, IV, and data
 * @returns Object with prepareCryptoData function
 */
export function useCryptoDataPreparation(state: ExtendedCryptoState) {
  /**
   * Prepares crypto operation data by converting hex to bytes
   * @param isEncryption - True to use original data, false to use encrypted data
   * @returns Object containing key, IV, and data as Uint8Arrays
   * @throws {Error} If source data is not available
   */
  const prepareCryptoData = useCallback(
    (isEncryption: boolean) => {
      const keyBytes = hexToBytes(state.key);
      const ivBytes = state.mode !== "ECB" ? hexToBytes(state.iv) : undefined;
      const sourceData = isEncryption ? state.body : state.encryptedBody;

      if (!sourceData) {
        throw new Error("No data available for crypto operation");
      }

      const dataBytes = new Uint8Array(sourceData);

      return { keyBytes, ivBytes, dataBytes };
    },
    [state.key, state.iv, state.mode, state.body, state.encryptedBody]
  );

  return { prepareCryptoData };
}

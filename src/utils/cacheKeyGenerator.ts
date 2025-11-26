/**
 * Cache key generation utilities
 *
 * Generates unique identifiers for encryption cache based on key and image data.
 * Uses SHA-256 hashing for robust, collision-resistant cache keys.
 */

/**
 * Generate a unique cache key from encryption key and image bits
 *
 * Uses SHA-256 hash of the concatenated key and image data to create
 * a unique identifier for the cache. This ensures that any change to
 * either the key or the image will result in a different cache key.
 *
 * @param key - Encryption key as hex string
 * @param imageBits - Raw image file bits
 * @returns Promise resolving to hex string of SHA-256 hash
 *
 * @example
 * const cacheKey = await generateCacheKey("a1b2c3...", imageUint8Array);
 * // Returns: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 */
export async function generateCacheKey(key: string, imageBits: Uint8Array): Promise<string> {
  // Convert key hex string to bytes
  const keyBytes = new TextEncoder().encode(key);

  // Concatenate key and image bits
  const combined = new Uint8Array(keyBytes.length + imageBits.length);
  combined.set(keyBytes, 0);
  combined.set(imageBits, keyBytes.length);

  // Hash the combined data
  const hashBuffer = await crypto.subtle.digest("SHA-256", combined);

  // Convert hash to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Validate if a cache key matches the current key and image
 *
 * Regenerates the cache key and compares it with the provided cache key
 * to determine if the cache is still valid.
 *
 * @param cacheKey - Existing cache key to validate
 * @param key - Current encryption key
 * @param imageBits - Current image bits
 * @returns Promise resolving to true if cache key is valid
 *
 * @example
 * const isValid = await validateCacheKey(cache.cacheKey, currentKey, currentImage);
 * if (!isValid) {
 *   // Clear cache and re-encrypt
 * }
 */
export async function validateCacheKey(cacheKey: string, key: string, imageBits: Uint8Array): Promise<boolean> {
  const expectedKey = await generateCacheKey(key, imageBits);
  return cacheKey === expectedKey;
}

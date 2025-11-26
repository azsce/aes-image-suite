/**
 * Validates if a string is a valid hexadecimal string
 * @param hex - String to validate
 * @returns true if valid hex string, false otherwise
 */
export function isValidHex(hex: string): boolean {
  return /^[0-9a-fA-F]+$/.test(hex);
}

/**
 * Validates if a hex string has the correct length for a 256-bit key (64 characters)
 * @param hex - Hex string to validate
 * @returns true if valid 256-bit key, false otherwise
 */
export function isValidKey(hex: string): boolean {
  return hex.length === 64 && isValidHex(hex);
}

/**
 * Validates if a hex string has the correct length for a key of specified size
 * @param hex - Hex string to validate
 * @param keySize - Key size in bits (128, 192, or 256)
 * @returns true if valid key for the specified size, false otherwise
 */
export function isValidKeySize(hex: string, keySize: 128 | 192 | 256): boolean {
  const expectedLengthMap = {
    128: 32, // 16 bytes = 32 hex characters
    192: 48, // 24 bytes = 48 hex characters
    256: 64, // 32 bytes = 64 hex characters
  };

  const expectedLength = expectedLengthMap[keySize];
  return hex.length === expectedLength && isValidHex(hex);
}

/**
 * Validates if a hex string has the correct length for a 128-bit IV (32 characters)
 * @param hex - Hex string to validate
 * @returns true if valid 128-bit IV, false otherwise
 */
export function isValidIV(hex: string): boolean {
  return hex.length === 32 && isValidHex(hex);
}

/**
 * Converts a hex string to a Uint8Array (bit-level representation)
 *
 * LOSSLESS ENCRYPTION: This function converts hexadecimal key/IV strings
 * to raw byte arrays for use in AES encryption. Each pair of hex characters
 * (e.g., "a3") represents one byte (8 bits) of data.
 *
 * Example: "a3f1" → [163, 241] → 0b10100011 11110001
 *
 * @param hex - Hex string to convert (must have even length)
 * @returns Uint8Array containing the raw bits
 * @throws Error if hex string is invalid or has odd length
 */
export function hexToBytes(hex: string): Uint8Array {
  if (!isValidHex(hex)) {
    throw new Error("Invalid hex string: contains non-hexadecimal characters");
  }

  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string: must have even length");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }

  return bytes;
}

/**
 * Converts a Uint8Array to a hex string (bit-level representation)
 *
 * LOSSLESS ENCRYPTION: This function converts raw byte arrays (from binary
 * key files or encryption operations) to hexadecimal strings for display
 * and storage. Each byte (8 bits) becomes 2 hex characters.
 *
 * Example: [163, 241] → "a3f1"
 *
 * @param bytes - Uint8Array containing raw bits to convert
 * @returns Hex string representation (lowercase)
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generates a cryptographically secure random hex string of specified byte length
 *
 * SECURE KEY GENERATION: Uses the Web Crypto API (window.crypto.getRandomValues)
 * to generate cryptographically secure random numbers. This is essential for
 * encryption key security - never use Math.random() for cryptographic keys!
 *
 * @param byteLength - Number of bytes to generate (result will be 2x this length in hex)
 * @returns Random hex string (lowercase)
 */
export function generateRandomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

/**
 * Generates a random AES key of specified size
 *
 * AES KEY SIZES:
 * - AES-128: 16 bytes (128 bits) → 32 hex characters
 * - AES-192: 24 bytes (192 bits) → 48 hex characters
 * - AES-256: 32 bytes (256 bits) → 64 hex characters
 *
 * Uses cryptographically secure random number generation (Web Crypto API).
 *
 * @param keySize - Key size in bits (128, 192, or 256)
 * @returns Random key as hex string (lowercase)
 * @throws Error if key size is not 128, 192, or 256
 */
export function generateKey(keySize: 128 | 192 | 256 = 256): string {
  const byteLengthMap = {
    128: 16,
    192: 24,
    256: 32,
  };

  const byteLength = byteLengthMap[keySize];
  if (!byteLength) {
    throw new Error(`Invalid key size: ${String(keySize)}. Expected 128, 192, or 256 bits.`);
  }

  return generateRandomHex(byteLength);
}

/**
 * Generates a random 128-bit IV (16 bytes = 32 hex characters)
 *
 * INITIALIZATION VECTOR: AES always uses a 128-bit (16-byte) IV regardless
 * of key size. The IV must be unique for each encryption operation to ensure
 * security. Uses cryptographically secure random number generation.
 *
 * @returns Random 128-bit IV as hex string (lowercase, 32 characters)
 */
export function generateIV(): string {
  return generateRandomHex(16);
}

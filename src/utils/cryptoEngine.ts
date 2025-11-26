import * as aesjs from "aes-js";
import type { EncryptionMode } from "@/types/crypto.types";

/**
 * Apply PKCS7 padding to data for block cipher modes (ECB, CBC)
 *
 * IMPORTANT: PKCS7 always adds padding, even if data is already block-aligned.
 * If data length is a multiple of blockSize, we add a full block of padding.
 * This ensures we can always distinguish between real data and padding bytes.
 *
 * @param data - The data to pad
 * @param blockSize - The block size in bytes (16 for AES)
 * @returns Padded data
 */
export function pkcs7Pad(data: Uint8Array, blockSize: number = 16): Uint8Array {
  // Calculate padding length (1 to blockSize bytes)
  // If data is already aligned, add a full block of padding
  const remainder = data.length % blockSize;
  const paddingLength = remainder === 0 ? blockSize : blockSize - remainder;

  const paddedData = new Uint8Array(data.length + paddingLength);
  paddedData.set(data);

  // Fill padding bytes with the padding length value
  for (let i = data.length; i < paddedData.length; i++) {
    paddedData[i] = paddingLength;
  }

  return paddedData;
}

/**
 * Validates that data is not empty before attempting to unpad
 * @param data - The data to validate
 * @throws {Error} If data is empty
 */
function validatePaddingData(data: Uint8Array): void {
  if (data.length === 0) {
    throw new Error("Cannot unpad empty data");
  }
}

/**
 * Validates that padding length is within valid range (1-16 bytes for AES)
 * @param paddingLength - The padding length to validate
 * @throws {Error} If padding length is invalid
 */
function validatePaddingLength(paddingLength: number): void {
  if (paddingLength === 0 || paddingLength > 16) {
    throw new Error("Invalid padding length");
  }
}

/**
 * Verifies that all padding bytes have the correct value (PKCS7 standard)
 * In PKCS7, all padding bytes must equal the padding length
 * @param data - The padded data to verify
 * @param paddingLength - The expected padding length
 * @throws {Error} If any padding byte has an incorrect value
 */
function verifyPaddingBytes(data: Uint8Array, paddingLength: number): void {
  const startIndex = data.length - paddingLength;
  for (let i = startIndex; i < data.length; i++) {
    if (data[i] !== paddingLength) {
      // Provide detailed error information for debugging
      const paddingBytes = Array.from(data.slice(startIndex, data.length));
      throw new Error(
        `Invalid padding bytes: expected all bytes to be ${String(paddingLength)}, ` +
          `but found ${paddingBytes.join(", ")} at positions ${String(startIndex)}-${String(data.length - 1)}. ` +
          `This may indicate incorrect decryption key, IV, or encryption method.`
      );
    }
  }
}

/**
 * Remove PKCS7 padding from decrypted data
 * @param data - The padded data
 * @returns Unpadded data
 * @throws Error if padding is invalid
 */
export function pkcs7Unpad(data: Uint8Array): Uint8Array {
  validatePaddingData(data);

  const paddingLength = data[data.length - 1];
  validatePaddingLength(paddingLength);
  verifyPaddingBytes(data, paddingLength);

  return data.slice(0, data.length - paddingLength);
}

/**
 * Checks if an encryption mode requires an initialization vector
 * ECB mode doesn't use IV, while CBC and CTR modes require it
 * @param mode - The encryption mode to check
 * @returns True if mode requires IV (CBC or CTR)
 */
function requiresIV(mode: EncryptionMode): boolean {
  return mode !== "ECB";
}

/**
 * Checks if an IV is valid (present and correct length)
 * AES requires 16-byte (128-bit) initialization vectors
 * @param iv - The IV to validate
 * @returns True if IV is defined and has length 16
 */
function isValidIV(iv: Uint8Array | undefined): boolean {
  return iv !== undefined && iv.length === 16;
}

/**
 * Validates that IV is present and valid for modes that require it
 * @param iv - The IV to validate
 * @param mode - The encryption mode being used
 * @throws {Error} If mode requires IV but it's missing or invalid
 */
function validateIV(iv: Uint8Array | undefined, mode: EncryptionMode): void {
  if (requiresIV(mode) && !isValidIV(iv)) {
    throw new Error(`IV must be 16 bytes for ${mode} mode`);
  }
}

/**
 * Encrypts data using AES in ECB (Electronic Codebook) mode
 * ECB encrypts each block independently, which can reveal patterns in the data
 * @param data - The data to encrypt
 * @param key - The AES encryption key (128, 192, or 256-bit)
 * @returns Encrypted data with PKCS7 padding
 */
function encryptECB(data: Uint8Array, key: Uint8Array): Uint8Array {
  const paddedData = pkcs7Pad(data);
  const aesCipher = new aesjs.ModeOfOperation.ecb(key);
  return new Uint8Array(aesCipher.encrypt(paddedData));
}

/**
 * Encrypts data using AES in CBC (Cipher Block Chaining) mode
 * CBC chains blocks together using XOR with previous ciphertext, hiding patterns
 * @param data - The data to encrypt
 * @param key - The AES encryption key (128, 192, or 256-bit)
 * @param iv - The 128-bit initialization vector
 * @returns Encrypted data with PKCS7 padding
 */
function encryptCBC(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const paddedData = pkcs7Pad(data);
  const aesCipher = new aesjs.ModeOfOperation.cbc(key, iv);
  return new Uint8Array(aesCipher.encrypt(paddedData));
}

/**
 * Encrypts data using AES in CTR (Counter) mode
 *
 * CTR MODE ALGORITHM:
 * CTR mode turns a block cipher into a stream cipher by encrypting counter values
 * and XORing them with the plaintext. No padding is needed.
 *
 * Encryption Process:
 * - Counter₁ = IV (random number, used as initial counter value)
 * - Counter_{i+1} = Counter_i + 1 (auto-incremented for each block)
 * - O_i = E_k(Counter_i) (encrypt counter with key)
 * - C_i = P_i ⊕ O_i (XOR plaintext with encrypted counter)
 *
 * Example:
 * - C₁ = P₁ ⊕ E(k, Counter₁)
 * - C₂ = P₂ ⊕ E(k, Counter₁ + 1)
 * - C₃ = P₃ ⊕ E(k, Counter₁ + 2)
 *
 * Key Properties:
 * - Stream cipher mode (processes data bit-by-bit, no padding required)
 * - Encryption and decryption use the same operation (XOR is symmetric)
 * - Counter must never be reused with the same key (IV must be unique)
 * - Suitable for high-speed network encryptions and parallel processing
 *
 * @param data - The data to encrypt
 * @param key - The AES encryption key (128, 192, or 256-bit)
 * @param iv - The 128-bit initialization vector (used as initial counter value)
 * @returns Encrypted data (no padding in CTR mode)
 */
function encryptCTR(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const aesCipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  return new Uint8Array(aesCipher.encrypt(data));
}

/**
 * Validates that the encryption key is a valid AES key length
 * AES supports three key sizes: 128-bit (16 bytes), 192-bit (24 bytes), and 256-bit (32 bytes)
 * @param key - The key to validate
 * @throws {Error} If key is not 16, 24, or 32 bytes
 */
function validateKey(key: Uint8Array): void {
  const validKeySizes = [16, 24, 32]; // 128-bit, 192-bit, 256-bit
  if (!validKeySizes.includes(key.length)) {
    throw new Error(
      `Invalid key size: ${String(key.length)} bytes. Key must be 16 bytes (128-bit), 24 bytes (192-bit), or 32 bytes (256-bit)`
    );
  }
}

/**
 * Encryption mode handlers mapping
 * Maps each encryption mode to its corresponding encryption function
 */
const encryptionHandlers: Record<EncryptionMode, (data: Uint8Array, key: Uint8Array, iv?: Uint8Array) => Uint8Array> = {
  ECB: encryptECB,
  CBC: (data, key, iv) => {
    if (!iv) throw new Error("IV is required for CBC mode");
    return encryptCBC(data, key, iv);
  },
  CTR: (data, key, iv) => {
    if (!iv) throw new Error("IV is required for CTR mode");
    return encryptCTR(data, key, iv);
  },
};

/**
 * Crypto operation parameters
 */
interface CryptoOperationParams {
  handlers: Record<EncryptionMode, (data: Uint8Array, key: Uint8Array, iv?: Uint8Array) => Uint8Array>;
  data: Uint8Array;
  key: Uint8Array;
  mode: EncryptionMode;
  iv?: Uint8Array;
  operationName: string;
}

/**
 * Dispatches a crypto operation to the appropriate handler based on mode
 * @param params - Operation parameters including mode and handlers
 * @returns Result of the crypto operation
 */
function dispatchCryptoOperation(params: CryptoOperationParams): Uint8Array {
  const handler = params.handlers[params.mode];
  return handler(params.data, params.key, params.iv);
}

/**
 * Crypto execution parameters
 */
interface CryptoExecutionParams {
  data: Uint8Array;
  key: Uint8Array;
  mode: EncryptionMode;
  iv?: Uint8Array;
  handlers: Record<EncryptionMode, (data: Uint8Array, key: Uint8Array, iv?: Uint8Array) => Uint8Array>;
  operationName: string;
}

/**
 * Executes a crypto operation with full validation of key and IV
 * @param params - Execution parameters including data, key, mode, and handlers
 * @returns Result of the crypto operation
 * @throws {Error} If key or IV validation fails
 */
function executeCryptoOperation(params: CryptoExecutionParams): Uint8Array {
  validateKey(params.key);
  validateIV(params.iv, params.mode);
  return dispatchCryptoOperation({
    handlers: params.handlers,
    data: params.data,
    key: params.key,
    mode: params.mode,
    iv: params.iv,
    operationName: params.operationName,
  });
}

/**
 * Decrypts data using AES in ECB mode and removes PKCS7 padding
 * @param data - The encrypted data to decrypt
 * @param key - The AES decryption key (128, 192, or 256-bit)
 * @returns Decrypted data with padding removed
 */
function decryptECB(data: Uint8Array, key: Uint8Array): Uint8Array {
  const aesCipher = new aesjs.ModeOfOperation.ecb(key);
  const decryptedData = new Uint8Array(aesCipher.decrypt(data));
  return pkcs7Unpad(decryptedData);
}

/**
 * Decrypts data using AES in CBC mode and removes PKCS7 padding
 * @param data - The encrypted data to decrypt
 * @param key - The AES decryption key (128, 192, or 256-bit)
 * @param iv - The 128-bit initialization vector (must match encryption IV)
 * @returns Decrypted data with padding removed
 */
function decryptCBC(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const aesCipher = new aesjs.ModeOfOperation.cbc(key, iv);
  const decryptedData = new Uint8Array(aesCipher.decrypt(data));
  return pkcs7Unpad(decryptedData);
}

/**
 * Decrypts data using AES in CTR mode (no padding removal needed)
 *
 * CTR MODE DECRYPTION:
 * CTR mode encryption and decryption are identical operations because XOR is symmetric.
 * The same counter sequence is encrypted and XORed with the ciphertext to recover plaintext.
 *
 * Decryption Process:
 * - Counter₁ = IV (same initial counter value used during encryption)
 * - Counter_{i+1} = Counter_i + 1 (auto-incremented for each block)
 * - O_i = E_k(Counter_i) (encrypt counter with key - same as encryption)
 * - P_i = C_i ⊕ O_i (XOR ciphertext with encrypted counter)
 *
 * Example:
 * - P₁ = C₁ ⊕ E(k, Counter₁)
 * - P₂ = C₂ ⊕ E(k, Counter₁ + 1)
 * - P₃ = C₃ ⊕ E(k, Counter₁ + 2)
 *
 * Why Encryption and Decryption are the Same:
 * - Encryption: C = P ⊕ E(k, Counter)
 * - Decryption: P = C ⊕ E(k, Counter) = (P ⊕ E(k, Counter)) ⊕ E(k, Counter) = P
 * - XOR property: A ⊕ B ⊕ B = A
 *
 * @param data - The encrypted data to decrypt
 * @param key - The AES decryption key (128, 192, or 256-bit)
 * @param iv - The 128-bit initialization vector (must match encryption IV)
 * @returns Decrypted data (no padding removal needed)
 */
function decryptCTR(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  const aesCipher = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(iv));
  return new Uint8Array(aesCipher.decrypt(data));
}

/**
 * Decryption mode handlers mapping
 * Maps each encryption mode to its corresponding decryption function
 */
const decryptionHandlers: Record<EncryptionMode, (data: Uint8Array, key: Uint8Array, iv?: Uint8Array) => Uint8Array> = {
  ECB: decryptECB,
  CBC: (data, key, iv) => {
    if (!iv) throw new Error("IV is required for CBC mode");
    return decryptCBC(data, key, iv);
  },
  CTR: (data, key, iv) => {
    if (!iv) throw new Error("IV is required for CTR mode");
    return decryptCTR(data, key, iv);
  },
};

/**
 * Factory function to create a crypto operation function (encrypt or decrypt)
 * This allows code reuse between encryption and decryption operations
 * @param handlers - The mode-specific handlers (encryption or decryption)
 * @param operationName - Name of the operation for error messages
 * @returns A function that performs the crypto operation
 */
function createCryptoFunction(
  handlers: Record<EncryptionMode, (data: Uint8Array, key: Uint8Array, iv?: Uint8Array) => Uint8Array>,
  operationName: string
) {
  return (data: Uint8Array, key: Uint8Array, mode: EncryptionMode, iv?: Uint8Array): Uint8Array => {
    return executeCryptoOperation({
      data,
      key,
      mode,
      iv,
      handlers,
      operationName,
    });
  };
}

/**
 * Encrypt data using AES with the specified mode
 *
 * LOSSLESS ENCRYPTION: This function encrypts raw file bits without any
 * preprocessing or format conversion. The encrypted output can be decrypted
 * to recover the exact original bits, ensuring bit-perfect reconstruction.
 *
 * Supports three AES key sizes:
 * - AES-128: 16-byte key (128 bits)
 * - AES-192: 24-byte key (192 bits)
 * - AES-256: 32-byte key (256 bits)
 *
 * @param data - The data to encrypt (raw file bits)
 * @param key - AES encryption key (16, 24, or 32 bytes for 128, 192, or 256-bit)
 * @param mode - Encryption mode (ECB, CBC, or CTR)
 * @param iv - Initialization vector for CBC/CTR modes (16 bytes, not used for ECB)
 * @returns Encrypted data (with PKCS7 padding for ECB/CBC, no padding for CTR)
 */
export const encrypt = createCryptoFunction(encryptionHandlers, "encryption");

/**
 * Decrypt data using AES with the specified mode
 *
 * LOSSLESS DECRYPTION: This function decrypts encrypted bits and removes
 * padding to recover the exact original data. When used with the correct
 * key, IV, and mode, produces bit-perfect reconstruction of the original file.
 *
 * Supports three AES key sizes:
 * - AES-128: 16-byte key (128 bits)
 * - AES-192: 24-byte key (192 bits)
 * - AES-256: 32-byte key (256 bits)
 *
 * @param data - The encrypted data
 * @param key - AES decryption key (16, 24, or 32 bytes for 128, 192, or 256-bit)
 * @param mode - Encryption mode (ECB, CBC, or CTR)
 * @param iv - Initialization vector for CBC/CTR modes (16 bytes, must match encryption IV)
 * @returns Decrypted data (PKCS7 padding removed for ECB/CBC)
 */
export const decrypt = createCryptoFunction(decryptionHandlers, "decryption");

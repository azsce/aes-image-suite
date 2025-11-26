import {
  validateJSON,
  validateKey,
  validateIV,
  VALIDATION_ERRORS,
  EncryptionKey,
  InitializationVector,
  JsonString,
} from "./validation";

export type EncryptionMethod = "ECB" | "CBC" | "CTR";

/**
 * Domain type for ISO 8601 timestamp strings
 */
export class Timestamp {
  constructor(public readonly value: string) {}

  isValid(): boolean {
    const date = new Date(this.value);
    return !Number.isNaN(date.getTime());
  }

  static now(): Timestamp {
    return new Timestamp(new Date().toISOString());
  }
}

/**
 * Domain type for semantic version strings (X.Y format)
 */
export class Version {
  constructor(public readonly value: string) {}

  isValid(): boolean {
    return /^\d+\.\d+$/.test(this.value);
  }

  static default(): Version {
    return new Version("1.0");
  }
}

/**
 * Domain type for filenames without extensions
 */
export class Filename {
  constructor(public readonly value: string) {}

  getValue(): string {
    return this.value;
  }
}

export interface KeyFileData {
  key: string;
  iv?: string;
  method: EncryptionMethod;
  timestamp: string;
  version: string;
}

export interface KeyFileParams {
  key: string;
  iv?: string;
  method: EncryptionMethod;
}

/**
 * Validation utilities for key file data
 *
 * This object contains all validation functions for key file parsing.
 * Each validator throws an error if validation fails, allowing for
 * precise error messages to be propagated to the user.
 */
const validators = {
  /**
   * Validates encryption key format and length
   * @param key - The encryption key to validate (should be 64 hex characters)
   * @throws {Error} If key format or length is invalid
   */
  key: (key: string): void => {
    const result = validateKey(new EncryptionKey(key));
    if (!result.valid && result.error) {
      throw new Error(result.error);
    }
  },

  /**
   * Validates initialization vector format and length
   * @param iv - The IV to validate (should be 32 hex characters)
   * @throws {Error} If IV format or length is invalid
   */
  iv: (iv: string): void => {
    const result = validateIV(new InitializationVector(iv));
    if (!result.valid && result.error) {
      throw new Error(result.error);
    }
  },

  /**
   * Type guard to check if a string is a valid encryption method
   * @param method - The method string to validate
   * @returns True if method is 'ECB', 'CBC', or 'CTR'
   */
  method: (method: string): method is EncryptionMethod => {
    const validMethods: EncryptionMethod[] = ["ECB", "CBC", "CTR"];
    return validMethods.includes(method as EncryptionMethod);
  },

  /**
   * Validates that all required fields are present and valid in key file data
   * @param data - Partial key file data to validate
   * @throws {Error} If required fields (key, method) are missing or invalid
   */
  requiredFields: (data: Partial<KeyFileData>): void => {
    if (!data.key || typeof data.key !== "string") {
      throw new Error('Missing or invalid "key" field');
    }

    if (!data.method || !validators.method(data.method)) {
      throw new Error('Missing or invalid "method" field. Expected ECB, CBC, or CTR');
    }

    validators.key(data.key);
  },

  /**
   * Validates optional fields in key file data if they are present
   * @param data - Partial key file data to validate
   * @throws {Error} If optional fields (iv, timestamp, version) are present but invalid
   */
  optionalFields: (data: Partial<KeyFileData>): void => {
    validators.validateIv(data.iv, data.method);
    validators.validateTimestamp(data.timestamp);
    validators.validateVersion(data.version);
  },

  /**
   * Validates IV field if present
   * Note: ECB mode doesn't use IV, but we accept it in key files for compatibility
   * @param iv - The IV value to validate (optional)
   * @param method - The encryption method (used to check ECB compatibility)
   * @throws {Error} If IV is present but has invalid format
   */
  validateIv: (iv: string | undefined, method?: string): void => {
    if (iv === undefined) {
      return;
    }

    if (typeof iv !== "string") {
      throw new Error("Invalid IV format. Expected string");
    }

    // Validate IV format
    validators.iv(iv);

    // Warn if IV is provided for ECB mode (though we'll still accept it)
    if (method === "ECB" && iv) {
      // ECB doesn't use IV, but we won't throw an error
      // Just silently ignore it during key file generation
    }
  },

  /**
   * Validates timestamp field if present
   * Ensures timestamp is a valid ISO 8601 date string
   * @param timestamp - The timestamp to validate (optional)
   * @throws {Error} If timestamp is present but not a valid ISO 8601 date
   */
  validateTimestamp: (timestamp: string | undefined): void => {
    if (timestamp === undefined) {
      return;
    }

    if (typeof timestamp !== "string") {
      throw new Error("Invalid timestamp format. Expected string");
    }

    const ts = new Timestamp(timestamp);
    if (!ts.isValid()) {
      throw new Error("Invalid timestamp format. Expected ISO 8601 date string");
    }
  },

  /**
   * Validates version field if present
   * Ensures version follows semantic versioning format (X.Y)
   * @param version - The version string to validate (optional)
   * @throws {Error} If version is present but doesn't match X.Y format
   */
  validateVersion: (version: string | undefined): void => {
    if (version === undefined) {
      return;
    }

    if (typeof version !== "string") {
      throw new Error("Invalid version format. Expected string");
    }

    const ver = new Version(version);
    if (!ver.isValid()) {
      throw new Error('Invalid version format. Expected format: "X.Y"');
    }
  },
};

/**
 * Reads file content as text with error handling
 * @param file - The file to read
 * @returns Promise resolving to file content as string
 * @throws {Error} If file cannot be read
 */
async function readFileContent(file: File): Promise<string> {
  try {
    return await file.text();
  } catch {
    throw new Error("Failed to read key file");
  }
}

/**
 * Type guard to check if a parsed JSON value is a valid object
 * Excludes null and arrays, which are technically objects in JavaScript
 * @param value - The value to check
 * @returns True if value is a non-null, non-array object
 */
function isValidObject(value: unknown): value is Record<string, unknown> {
  if (value === null) {
    return false;
  }

  if (Array.isArray(value)) {
    return false;
  }

  return typeof value === "object";
}

/**
 * Parses JSON text and validates it's a valid object structure
 * @param text - The JSON text to parse
 * @returns Parsed key file data (partial, as not all fields may be present)
 * @throws {Error} If JSON is invalid or not an object
 */
function parseAndValidateJSON(text: string): Partial<KeyFileData> {
  const jsonValidation = validateJSON(new JsonString(text));
  if (!jsonValidation.valid) {
    throw new Error(jsonValidation.error || VALIDATION_ERRORS.KEY_FILE_INVALID_JSON);
  }

  const parsed: unknown = JSON.parse(text);

  if (!isValidObject(parsed)) {
    throw new Error("Key file must contain a JSON object");
  }

  return parsed as Partial<KeyFileData>;
}

/**
 * Checks for unexpected properties in key file data and warns in development
 * This helps catch typos or outdated key file formats
 * @param data - The parsed key file data to check
 */
function checkUnexpectedProperties(data: Partial<KeyFileData>): void {
  const allowedKeys = ["key", "iv", "method", "timestamp", "version"];
  const dataKeys = Object.keys(data);
  const hasUnexpectedKeys = dataKeys.some(k => !allowedKeys.includes(k));

  if (hasUnexpectedKeys && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn("Key file contains unexpected properties, ignoring them");
  }
}

/**
 * Creates a clean KeyFileData object from validated data
 * Trims whitespace and provides defaults for optional fields
 * @param data - The validated partial key file data
 * @returns Complete KeyFileData object with all required fields
 */
function createCleanKeyFileData(data: Partial<KeyFileData>): KeyFileData {
  const key = data.key ? data.key.trim() : "";
  const method = data.method as EncryptionMethod;
  const iv = data.iv ? data.iv.trim() : undefined;
  const timestamp = data.timestamp ? data.timestamp.trim() : Timestamp.now().value;
  const version = data.version ? data.version.trim() : Version.default().value;

  return { key, iv, method, timestamp, version };
}

/**
 * Handles parsing errors and converts them to user-friendly messages
 * @param error - The error that occurred during parsing
 * @throws {Error} Always throws with a user-friendly error message
 */
function handleParsingError(error: unknown): never {
  if (error instanceof SyntaxError) {
    throw new Error(VALIDATION_ERRORS.KEY_FILE_INVALID_JSON);
  }

  if (error instanceof Error) {
    throw new Error(`Key file validation failed: ${error.message}`);
  }

  throw new Error(VALIDATION_ERRORS.KEY_FILE_INVALID_STRUCTURE);
}

/**
 * Parse and validate a JSON key file
 * @param file - The key file to parse
 * @returns Parsed and validated key file data
 * @throws Error if file is invalid or malformed
 */
export const parseKeyFile = async (file: File): Promise<KeyFileData> => {
  const text = await readFileContent(file);

  try {
    const data = parseAndValidateJSON(text);
    checkUnexpectedProperties(data);
    validators.requiredFields(data);
    validators.optionalFields(data);
    return createCleanKeyFileData(data);
  } catch (error) {
    return handleParsingError(error);
  }
};

/**
 * Binary key file data structure
 *
 * Represents the parsed contents of a binary key file.
 * The binary format uses a compact frame structure with no file extension.
 */
export interface BinaryKeyFileData {
  key: Uint8Array; // AES encryption key (16, 24, or 32 bytes)
  iv?: Uint8Array; // Initialization vector (16 bytes, optional for ECB)
}

const VALID_KEY_SIZES = [16, 24, 32] as const; // AES-128, AES-192, AES-256
const VALID_IV_SIZE = 16;

interface BinaryFrameData {
  key: Uint8Array;
  iv: Uint8Array | undefined;
  keyLength: number;
  ivLength: number;
}

function validateKeySize(keyLength: number): void {
  if (!VALID_KEY_SIZES.includes(keyLength as (typeof VALID_KEY_SIZES)[number])) {
    throw new Error(`Invalid key size: ${String(keyLength * 8)} bits. Expected 128, 192, or 256 bits.`);
  }
}

function validateIVSize(ivLength: number): void {
  if (ivLength !== VALID_IV_SIZE) {
    throw new Error(`Invalid IV size: ${String(ivLength * 8)} bits. Expected 128 bits (16 bytes).`);
  }
}

function validateIVRequirements(mode: EncryptionMethod, iv: Uint8Array | undefined): void {
  const requiresIV = mode !== "ECB";

  if (requiresIV && !iv) {
    throw new Error(`${mode} mode requires IV`);
  }

  if (!requiresIV && iv) {
    throw new Error("ECB mode does not use IV");
  }
}

function createBinaryFileFrame(frameData: BinaryFrameData): Uint8Array {
  const totalSize = 2 + frameData.keyLength + frameData.ivLength;
  const binaryFile = new Uint8Array(totalSize);

  binaryFile[0] = frameData.keyLength;
  binaryFile[1] = frameData.ivLength;
  binaryFile.set(frameData.key, 2);

  if (frameData.iv) {
    binaryFile.set(frameData.iv, 2 + frameData.keyLength);
  }

  return binaryFile;
}

/**
 * Generate binary key file with frame structure
 *
 * BINARY KEY FILE FORMAT:
 * This function creates a compact binary key file with a simple frame structure.
 * The file has no extension and uses a 2-byte header followed by key and IV data.
 *
 * Frame structure:
 * - Byte 0: Key length (16, 24, or 32 bytes for AES-128/192/256)
 * - Byte 1: IV length (0 for ECB, 16 for CBC/CTR)
 * - Bytes 2+: Key bytes (16, 24, or 32 bytes)
 * - Bytes N+: IV bytes (16 bytes if present)
 *
 * Examples:
 * - AES-256 + CBC: [32][16][...32 key bytes...][...16 IV bytes...] = 50 bytes
 * - AES-128 + ECB: [16][0][...16 key bytes...] = 18 bytes
 * - AES-192 + CTR: [24][16][...24 key bytes...][...16 IV bytes...] = 42 bytes
 *
 * @param key - Encryption key as Uint8Array (16, 24, or 32 bytes)
 * @param mode - Encryption mode (ECB, CBC, or CTR)
 * @param iv - Initialization vector as Uint8Array (16 bytes, optional)
 * @returns Binary key file as Uint8Array
 * @throws Error if key or IV have invalid sizes
 */
export function generateBinaryKeyFile(
  key: Uint8Array,
  mode: EncryptionMethod,
  iv?: Uint8Array
): Uint8Array {
  const keyLength = key.length;

  // In ECB mode, we explicitly ignore any provided IV to prevent validation errors
  // This ensures that even if an IV is passed (e.g. from state), it's not used for ECB
  const effectiveIV = mode === "ECB" ? undefined : iv;
  const ivLength = effectiveIV ? effectiveIV.length : 0;

  validateKeySize(keyLength);
  validateIVRequirements(mode, effectiveIV);

  if (effectiveIV) {
    validateIVSize(effectiveIV.length);
  }

  const frameData: BinaryFrameData = { key, iv: effectiveIV, keyLength, ivLength };
  return createBinaryFileFrame(frameData);
}

function validateBinaryFileHeader(bits: Uint8Array): void {
  if (bits.length < 2) {
    throw new Error("Invalid key file: too small (minimum 2 bytes for header)");
  }
}

function validateBinaryKeyLength(keyLength: number): void {
  if (!VALID_KEY_SIZES.includes(keyLength as (typeof VALID_KEY_SIZES)[number])) {
    throw new Error(`Invalid key size in file: ${String(keyLength * 8)} bits. Expected 128, 192, or 256 bits.`);
  }
}

function validateBinaryIVLength(ivLength: number): void {
  const validIVLengths = [0, VALID_IV_SIZE];
  if (!validIVLengths.includes(ivLength)) {
    throw new Error(`Invalid IV size in file: ${String(ivLength * 8)} bits. Expected 0 or 128 bits.`);
  }
}

interface FileSizeValidation {
  actualSize: number;
  expectedSize: number;
  keyLength: number;
  ivLength: number;
}

function validateBinaryFileSize(sizeData: FileSizeValidation): void {
  if (sizeData.actualSize !== sizeData.expectedSize) {
    throw new Error(
      `Invalid key file: expected ${String(sizeData.expectedSize)} bytes ` +
        `(2 header + ${String(sizeData.keyLength)} key + ${String(sizeData.ivLength)} IV), got ${String(sizeData.actualSize)} bytes`
    );
  }
}

interface KeyIVExtraction {
  bits: Uint8Array;
  keyLength: number;
  ivLength: number;
}

function extractKeyAndIV(extractionData: KeyIVExtraction): BinaryKeyFileData {
  const key = extractionData.bits.slice(2, 2 + extractionData.keyLength);
  const iv =
    extractionData.ivLength > 0
      ? extractionData.bits.slice(2 + extractionData.keyLength, 2 + extractionData.keyLength + extractionData.ivLength)
      : undefined;
  return { key, iv };
}

/**
 * Parse binary key file with frame structure
 *
 * Reads and validates a binary key file, extracting the key and IV based on
 * the frame header. Automatically detects key size (AES-128/192/256) from
 * the first byte of the file.
 *
 * @param bits - Binary key file as Uint8Array
 * @returns Parsed key file data with key and optional IV
 * @throws Error if file format is invalid or frame structure is corrupted
 */
export function parseBinaryKeyFile(bits: Uint8Array): BinaryKeyFileData {
  validateBinaryFileHeader(bits);

  const keyLength = bits[0];
  const ivLength = bits[1];

  validateBinaryKeyLength(keyLength);
  validateBinaryIVLength(ivLength);

  const expectedSize = 2 + keyLength + ivLength;
  const sizeData: FileSizeValidation = {
    actualSize: bits.length,
    expectedSize,
    keyLength,
    ivLength,
  };
  validateBinaryFileSize(sizeData);

  const extractionData: KeyIVExtraction = { bits, keyLength, ivLength };
  return extractKeyAndIV(extractionData);
}

function validateKeyDataSize(keyLength: number): void {
  if (!VALID_KEY_SIZES.includes(keyLength as (typeof VALID_KEY_SIZES)[number])) {
    throw new Error(`Invalid key size: ${String(keyLength * 8)} bits. ` + `Expected 128, 192, or 256 bits.`);
  }
}

function validateModeIVCompatibility(selectedMode: EncryptionMethod, hasIV: boolean): void {
  const isECBMode = selectedMode === "ECB";

  if (isECBMode && hasIV) {
    throw new Error("ECB mode does not use IV. Key file should have IV length = 0x00.");
  }

  if (!isECBMode && !hasIV) {
    throw new Error(`${selectedMode} mode requires IV. Key file should have IV length = 0x10.`);
  }
}

function validateIVDataSize(iv: Uint8Array | undefined): void {
  if (iv && iv.length !== VALID_IV_SIZE) {
    throw new Error(`Invalid IV size: ${String(iv.length * 8)} bits. Expected 128 bits (16 bytes).`);
  }
}

/**
 * Validate binary key file data against selected encryption mode
 *
 * Ensures that the key file contents match the requirements of the selected
 * encryption mode. ECB mode must not have an IV, while CBC and CTR modes
 * require a 16-byte IV. Supports all three AES key sizes (128, 192, 256-bit).
 *
 * @param keyData - Parsed key file data
 * @param selectedMode - Selected encryption mode (ECB, CBC, or CTR)
 * @throws Error if key file doesn't match selected mode requirements
 */
export function validateBinaryKeyFile(keyData: BinaryKeyFileData, selectedMode: EncryptionMethod): void {
  validateKeyDataSize(keyData.key.length);
  validateModeIVCompatibility(selectedMode, Boolean(keyData.iv));
  validateIVDataSize(keyData.iv);
}

/**
 * Download binary file with no extension
 * @param bits - Binary file data as Uint8Array
 * @param filename - Filename without extension
 */
export function downloadBinaryFile(bits: Uint8Array, filename: Filename): void {
  const blob = new Blob([bits.buffer as ArrayBuffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.getValue();
  link.click();
  URL.revokeObjectURL(url);
}

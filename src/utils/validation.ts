/**
 * Comprehensive validation utilities for file uploads, keys, IVs, and user inputs
 */

import { appConfig } from "../../app.config";

// File validation constants (imported from config)
export const MAX_FILE_SIZE = appConfig.upload.maxFileSizeBytes;
export const MAX_FILE_SIZE_MB = appConfig.upload.maxFileSizeMB;
export const ACCEPTED_IMAGE_TYPES = [...appConfig.upload.acceptedImageTypes] as string[];
export const ACCEPTED_IMAGE_EXTENSIONS = [...appConfig.upload.acceptedImageExtensions] as string[];

// Validation error messages
export const VALIDATION_ERRORS = {
  FILE_INVALID_TYPE: "Please upload a valid image file",
  FILE_TOO_LARGE: `File size exceeds ${String(MAX_FILE_SIZE_MB)}MB limit`,
  FILE_READ_FAILED: "Failed to read file. Please try again",
  FILE_MALFORMED: "The image file appears to be corrupted or malformed",
  KEY_INVALID_FORMAT: "Invalid key format. Expected 64 hexadecimal characters",
  KEY_INVALID_LENGTH: "Key must be exactly 64 hexadecimal characters",
  IV_INVALID_FORMAT: "Invalid IV format. Expected 32 hexadecimal characters",
  IV_INVALID_LENGTH: "IV must be exactly 32 hexadecimal characters",
  KEY_FILE_INVALID_JSON: "Invalid JSON format in key file",
  KEY_FILE_MISSING_FIELDS: "Invalid key file format. Expected JSON with key, iv, and method fields",
  KEY_FILE_INVALID_STRUCTURE: "Key file structure is invalid",

  // Binary key file errors
  BINARY_KEY_FILE_TOO_SMALL: "Invalid key file: file is too small (minimum 2 bytes required for header)",
  BINARY_KEY_FILE_INVALID_KEY_SIZE: (keySize: number) =>
    `Invalid key size in file: ${String(keySize * 8)} bits. Expected 128, 192, or 256 bits (16, 24, or 32 bytes)`,
  BINARY_KEY_FILE_INVALID_IV_SIZE: (ivSize: number) =>
    `Invalid IV size in file: ${String(ivSize * 8)} bits. Expected 0 or 128 bits (0 or 16 bytes)`,
  BINARY_KEY_FILE_SIZE_MISMATCH: (expected: number, actual: number, keyLength: number, ivLength: number) =>
    `Invalid key file: expected ${String(expected)} bytes (2 header + ${String(keyLength)} key + ${String(ivLength)} IV), got ${String(actual)} bytes`,

  // Key size mismatch errors
  KEY_SIZE_UNSUPPORTED: (keySize: number) =>
    `Invalid key size: ${String(keySize * 8)} bits. Expected 128, 192, or 256 bits`,
  KEY_SIZE_MISMATCH_MODE: (mode: string, hasIV: boolean) =>
    hasIV
      ? `${mode} mode requires IV. Key file should have IV length = 0x10 (16 bytes)`
      : `${mode} mode does not use IV. Key file should have IV length = 0x00`,

  // Missing IV errors
  IV_REQUIRED_FOR_MODE: (mode: string) =>
    `${mode} mode requires an initialization vector (IV). Please provide a 128-bit IV (32 hexadecimal characters)`,
  IV_NOT_ALLOWED_FOR_ECB:
    "ECB mode does not use an initialization vector (IV). Please remove the IV or switch to CBC/CTR mode",

  // MIME type validation errors
  MIME_TYPE_INVALID: (mimeType: string) =>
    `Invalid MIME type: ${mimeType}. Expected an image format (e.g., image/png, image/jpeg)`,
  MIME_TYPE_NOT_IMAGE: "File is not an image. Please upload a valid image file",
  MIME_TYPE_MISSING: "Unable to detect file type. Please ensure the file is a valid image",
} as const;

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface ImageValidationResult extends FileValidationResult {
  width?: number;
  height?: number;
}

/**
 * Validate file type by checking both MIME type and extension
 */
export function validateFileType(file: File): FileValidationResult {
  const isValidMimeType = ACCEPTED_IMAGE_TYPES.includes(file.type);
  const hasValidExtension = ACCEPTED_IMAGE_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));

  if (!isValidMimeType && !hasValidExtension) {
    return {
      valid: false,
      error: VALIDATION_ERRORS.FILE_INVALID_TYPE,
    };
  }

  return { valid: true };
}

/**
 * Validate file size
 */
export function validateFileSize(file: File): FileValidationResult {
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: `File size (${sizeMB}MB) exceeds the ${String(MAX_FILE_SIZE_MB)}MB limit`,
    };
  }

  return { valid: true };
}

/**
 * Validates image file integrity by attempting to load it
 *
 * This catches corrupted or malformed images that pass MIME type checks
 * but cannot be decoded. Includes a 5-second timeout to prevent hanging.
 *
 * @param file - The image file to validate
 * @returns Promise resolving to validation result with dimensions if valid
 */
export async function validateImageIntegrity(file: File): Promise<ImageValidationResult> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(url);
    };

    img.onload = () => {
      cleanup();
      resolve({
        valid: true,
        width: img.width,
        height: img.height,
      });
    };

    img.onerror = () => {
      cleanup();
      resolve({
        valid: false,
        error: VALIDATION_ERRORS.FILE_MALFORMED,
      });
    };

    // Set timeout to prevent hanging
    setTimeout(() => {
      cleanup();
      resolve({
        valid: false,
        error: VALIDATION_ERRORS.FILE_MALFORMED,
      });
    }, 5000);

    img.src = url;
  });
}

/**
 * Performs comprehensive file upload validation
 *
 * Validates in order:
 * 1. File type (MIME type and extension)
 * 2. File size (against configured limit)
 * 3. Image integrity (can be decoded)
 *
 * Stops at first failure for efficiency.
 *
 * @param file - The file to validate
 * @returns Promise resolving to validation result with dimensions if valid
 */
export async function validateImageUpload(file: File): Promise<ImageValidationResult> {
  // Check file type
  const typeResult = validateFileType(file);
  if (!typeResult.valid) {
    return typeResult;
  }

  // Check file size
  const sizeResult = validateFileSize(file);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  // Check image integrity
  const integrityResult = await validateImageIntegrity(file);
  if (!integrityResult.valid) {
    return integrityResult;
  }

  return integrityResult;
}

/**
 * Domain type representing a hexadecimal string
 *
 * Encapsulates hex string validation logic and provides methods
 * for checking format and length. This follows domain-driven design
 * principles by making validation rules explicit in the type system.
 */
export class HexString {
  constructor(public readonly value: string) { }

  isValidFormat(): boolean {
    return /^[0-9a-fA-F]+$/.test(this.value);
  }

  hasLength(expectedLength: number): boolean {
    return this.value.length === expectedLength;
  }

  isEmpty(): boolean {
    return !this.value;
  }
}

/**
 * Hex validation configuration
 */
interface HexValidation {
  hex: HexString;
  expectedLength: number;
  formatError: string;
  lengthError: string;
}

/**
 * Generic hex validation
 */
function validateHex(config: HexValidation): FileValidationResult {
  if (config.hex.isEmpty()) {
    return { valid: true };
  }

  if (!config.hex.isValidFormat()) {
    return { valid: false, error: config.formatError };
  }

  if (!config.hex.hasLength(config.expectedLength)) {
    return { valid: false, error: config.lengthError };
  }

  return { valid: true };
}

/**
 * Domain type representing a 256-bit AES encryption key
 *
 * Enforces that keys are exactly 64 hexadecimal characters (32 bytes).
 * This type ensures type safety and validation at the domain level.
 */
export class EncryptionKey {
  private static readonly VALID_LENGTHS = [32, 48, 64];
  private readonly hex: HexString;

  constructor(key: string) {
    this.hex = new HexString(key);
  }

  validate(): FileValidationResult {
    if (this.hex.isEmpty()) {
      return { valid: true };
    }

    if (!this.hex.isValidFormat()) {
      return { valid: false, error: VALIDATION_ERRORS.KEY_INVALID_FORMAT };
    }

    const length = this.hex.value.length;
    if (!EncryptionKey.VALID_LENGTHS.includes(length)) {
      return {
        valid: false,
        error: "Key must be 32, 48, or 64 hexadecimal characters (128, 192, or 256 bits)",
      };
    }

    return { valid: true };
  }
}

/**
 * Domain type representing a 128-bit initialization vector
 *
 * Enforces that IVs are exactly 32 hexadecimal characters (16 bytes).
 * IVs are required for CBC and CTR modes but not for ECB mode.
 */
export class InitializationVector {
  private static readonly EXPECTED_LENGTH = 32;
  private readonly hex: HexString;

  constructor(iv: string) {
    this.hex = new HexString(iv);
  }

  validate(): FileValidationResult {
    return validateHex({
      hex: this.hex,
      expectedLength: InitializationVector.EXPECTED_LENGTH,
      formatError: VALIDATION_ERRORS.IV_INVALID_FORMAT,
      lengthError: VALIDATION_ERRORS.IV_INVALID_LENGTH,
    });
  }
}

/**
 * Validate hexadecimal string format
 */
export function validateHexFormat(hexString: HexString): boolean {
  return hexString.isValidFormat();
}

/**
 * Validate encryption key (256-bit = 64 hex characters)
 */
export function validateKey(key: EncryptionKey): FileValidationResult {
  return key.validate();
}

/**
 * Validate initialization vector (128-bit = 32 hex characters)
 */
export function validateIV(iv: InitializationVector): FileValidationResult {
  return iv.validate();
}

/**
 * Real-time validation for key input (returns validation state)
 */
export interface KeyValidationState {
  isValid: boolean;
  isComplete: boolean;
  error?: string;
}

/**
 * Domain type for real-time encryption key input validation
 *
 * Provides progressive validation feedback as the user types:
 * - Empty: Valid but incomplete
 * - Invalid characters: Invalid with error message
 * - Too short: Valid but incomplete
 * - Too long: Invalid with error message
 * - Correct length: Valid and complete
 */
export class EncryptionKeyInput {
  private readonly hex: HexString;
  private readonly expectedLength: number;

  constructor(value: string, expectedLength: number = 64) {
    this.hex = new HexString(value);
    this.expectedLength = expectedLength;
  }

  getValidationState(): KeyValidationState {
    if (this.hex.isEmpty()) {
      return { isValid: true, isComplete: false };
    }

    if (!this.hex.isValidFormat()) {
      return {
        isValid: false,
        isComplete: false,
        error: "Only hexadecimal characters (0-9, a-f) are allowed",
      };
    }

    if (!this.hex.hasLength(this.expectedLength)) {
      const isTooShort = !this.hex.hasLength(this.expectedLength) && this.hex.isValidFormat();
      if (isTooShort) {
        return { isValid: true, isComplete: false };
      }
      return {
        isValid: false,
        isComplete: false,
        error: "Key is too long",
      };
    }

    return { isValid: true, isComplete: true };
  }
}

/**
 * Domain type for real-time IV input validation
 *
 * Similar to EncryptionKeyInput but for 32-character IVs.
 * Provides progressive validation feedback during user input.
 */
export class IVInput {
  private static readonly EXPECTED_LENGTH = 32;
  private readonly hex: HexString;

  constructor(value: string) {
    this.hex = new HexString(value);
  }

  getValidationState(): KeyValidationState {
    if (this.hex.isEmpty()) {
      return { isValid: true, isComplete: false };
    }

    if (!this.hex.isValidFormat()) {
      return {
        isValid: false,
        isComplete: false,
        error: "Only hexadecimal characters (0-9, a-f) are allowed",
      };
    }

    if (!this.hex.hasLength(IVInput.EXPECTED_LENGTH)) {
      const isTooShort = !this.hex.hasLength(IVInput.EXPECTED_LENGTH) && this.hex.isValidFormat();
      if (isTooShort) {
        return { isValid: true, isComplete: false };
      }
      return {
        isValid: false,
        isComplete: false,
        error: "IV is too long",
      };
    }

    return { isValid: true, isComplete: true };
  }
}

export function getKeyValidationState(keyInput: EncryptionKeyInput): KeyValidationState {
  return keyInput.getValidationState();
}

export function getIVValidationState(ivInput: IVInput): KeyValidationState {
  return ivInput.getValidationState();
}

/**
 * Domain type for text trimming
 */
class TextTrimmer {
  private static readonly TRIMMABLE_CHARS = [".", " "];

  constructor(private readonly text: string) { }

  private isTrimmableChar(char: string): boolean {
    return TextTrimmer.TRIMMABLE_CHARS.includes(char);
  }

  removeLeadingTrimmableChars(): string {
    let result = this.text;
    while (result.length > 0 && this.isTrimmableChar(result[0])) {
      result = result.slice(1);
    }
    return result;
  }

  removeTrailingTrimmableChars(): string {
    let result = this.text;
    while (result.length > 0 && this.isTrimmableChar(result[result.length - 1])) {
      result = result.slice(0, -1);
    }
    return result;
  }
}

/**
 * Domain type for filename length limiting
 */
class FilenameLengthLimiter {
  private static readonly MAX_LENGTH = 255;

  constructor(private readonly filename: string) { }

  limit(): string {
    if (this.filename.length <= FilenameLengthLimiter.MAX_LENGTH) {
      return this.filename;
    }

    const lastDotIndex = this.filename.lastIndexOf(".");
    const hasExtension = lastDotIndex !== -1;

    if (!hasExtension) {
      return this.filename.slice(0, FilenameLengthLimiter.MAX_LENGTH);
    }

    const ext = this.filename.slice(lastDotIndex);
    const nameWithoutExt = this.filename.slice(0, lastDotIndex);
    return nameWithoutExt.slice(0, FilenameLengthLimiter.MAX_LENGTH - ext.length) + ext;
  }
}

/**
 * Domain type for safe filename sanitization
 *
 * Removes or replaces dangerous characters that could cause issues
 * in file systems or security vulnerabilities. Handles:
 * - Path traversal characters (/, \, :)
 * - Special characters (<, >, ", |, ?, *)
 * - Leading/trailing dots and spaces
 * - Length limits (255 characters)
 */
export class SafeFilename {
  constructor(private readonly rawFilename: string) { }

  getSanitized(): string {
    let sanitized = this.rawFilename.replace(/[/\\:\0]/g, "");
    sanitized = sanitized.replace(/[<>"|?*]/g, "_");

    const trimmer = new TextTrimmer(sanitized);
    sanitized = trimmer.removeLeadingTrimmableChars();
    sanitized = new TextTrimmer(sanitized).removeTrailingTrimmableChars();

    const limiter = new FilenameLengthLimiter(sanitized);
    sanitized = limiter.limit();

    return sanitized || "download";
  }
}

/**
 * Sanitize filename for safe downloads
 * Removes or replaces potentially dangerous characters
 */
export function sanitizeFilename(filename: SafeFilename): string {
  return filename.getSanitized();
}

/**
 * Domain type for HTML tag removal
 */
class HtmlTagRemover {
  constructor(private readonly input: string) { }

  remove(): string {
    let result = "";
    let inTag = false;

    for (let i = 0; i < this.input.length; i++) {
      const char = this.input[i];
      if (char === "<") {
        inTag = true;
      } else if (char === ">") {
        inTag = false;
      } else if (!inTag) {
        result += char;
      }
    }

    return result;
  }
}

/**
 * Domain type for text with pattern
 */
class TextWithPattern {
  constructor(
    private readonly text: string,
    private readonly pattern: string
  ) { }

  removePattern(): string {
    let result = this.text;
    const lowerResult = result.toLowerCase();
    let index = lowerResult.indexOf(this.pattern);

    while (index !== -1) {
      result = result.slice(0, index) + result.slice(index + this.pattern.length);
      const newLowerResult = result.toLowerCase();
      index = newLowerResult.indexOf(this.pattern);
    }

    return result;
  }
}

/**
 * Domain type for event handler cleaner
 */
class EventHandlerCleaner {
  private static readonly PATTERNS = [
    "onclick=",
    "onload=",
    "onerror=",
    "onmouseover=",
    "onmouseout=",
    "onfocus=",
    "onblur=",
    "onchange=",
    "onsubmit=",
    "onkeydown=",
    "onkeyup=",
    "onkeypress=",
    "ondblclick=",
    "oncontextmenu=",
  ];

  constructor(private readonly input: string) { }

  clean(): string {
    let result = this.input;
    for (const patternStr of EventHandlerCleaner.PATTERNS) {
      const textWithPattern = new TextWithPattern(result, patternStr);
      result = textWithPattern.removePattern();
    }
    return result;
  }
}

/**
 * Domain type for sanitizing user input to prevent injection attacks
 *
 * Removes potentially dangerous content including:
 * - HTML tags
 * - JavaScript protocol handlers
 * - Event handler attributes (onclick, onload, etc.)
 *
 * This provides defense-in-depth against XSS attacks.
 */
export class SafeUserInput {
  constructor(private readonly rawInput: string) { }

  getSanitized(): string {
    const tagRemover = new HtmlTagRemover(this.rawInput);
    let sanitized = tagRemover.remove();

    sanitized = sanitized.replace(/javascript:/gi, "");

    const handlerCleaner = new EventHandlerCleaner(sanitized);
    sanitized = handlerCleaner.clean();

    return sanitized.trim();
  }
}

/**
 * Validate and sanitize user input to prevent injection attacks
 */
export function sanitizeUserInput(input: SafeUserInput): string {
  return input.getSanitized();
}

/**
 * Domain type for JSON string validation
 *
 * Safely validates JSON structure without executing code.
 * Uses try-catch to handle malformed JSON gracefully.
 */
export class JsonString {
  constructor(private readonly value: string) { }

  isValid(): boolean {
    try {
      JSON.parse(this.value);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Validate JSON structure safely without executing code
 */
export function validateJSON(jsonString: JsonString): FileValidationResult {
  if (!jsonString.isValid()) {
    return {
      valid: false,
      error: VALIDATION_ERRORS.KEY_FILE_INVALID_JSON,
    };
  }

  return { valid: true };
}

/**
 * Domain type for MIME type validation
 *
 * Validates that a MIME type represents an image format.
 * Checks both the general format and specific image type.
 */
export class MimeType {
  constructor(private readonly value: string) { }

  isEmpty(): boolean {
    return !this.value || this.value.trim() === "";
  }

  isImageType(): boolean {
    return this.value.startsWith("image/");
  }

  getValue(): string {
    return this.value;
  }
}

/**
 * Validate MIME type is a valid image format
 */
export function validateMimeType(mimeType: MimeType): FileValidationResult {
  if (mimeType.isEmpty()) {
    return {
      valid: false,
      error: VALIDATION_ERRORS.MIME_TYPE_MISSING,
    };
  }

  if (!mimeType.isImageType()) {
    return {
      valid: false,
      error: VALIDATION_ERRORS.MIME_TYPE_NOT_IMAGE,
    };
  }

  return { valid: true };
}

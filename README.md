# AES Image Encryption Suite 🔐

A professional web application for **lossless image encryption** using AES encryption algorithms (128, 192, or 256-bit). Features bit-perfect encryption/decryption, visual encryption pattern analysis, and a modern three-mode interface with automatic processing.

## ✨ Features

### Three-Mode Interface

- **🔒 Encryption Mode**: Upload images and automatically encrypt them with AES-256
- **🔓 Decryption Mode**: Decrypt encrypted images using key files or manual key entry
- **⚖️ Comparison Mode**: Verify image integrity with pixel-by-pixel comparison

### Encryption Capabilities

- **Lossless Encryption**: Bit-perfect encryption preserving all image data and format
- **Multiple AES Modes**: ECB, CBC, and CTR encryption methods
- **Flexible Key Sizes**: Support for AES-128, AES-192, and AES-256
- **Automatic Processing**: Operations execute automatically when inputs are ready
- **Binary Key Files**: Compact binary format with frame structure (no file extension)
- **Bundle Downloads**: Download encrypted images with their key files in a single ZIP
- **ECB Pattern Visualization**: See encryption patterns in real-time (famous "ECB penguin" effect)

### User Experience

- **Tab-Based Navigation**: Smooth transitions between modes with slide animations
- **Responsive Design**: Optimized layouts for mobile, tablet, and desktop
- **Dark/Light Themes**: System preference detection with manual toggle
- **Keyboard Shortcuts**: Quick access to common actions
- **Real-Time Validation**: Instant feedback on file formats and key validity

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime installed

### Installation

```bash
bun install
```

### Development

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Build

```bash
bun run build
```

### Preview Production Build

```bash
bun run preview
```

## 📖 Usage Guide

### 🔒 Encryption Workflow

1. **Select Encryption Mode**: Click the "Encryption" tab or press `1`
2. **Choose AES Method**: Select ECB, CBC, or CTR encryption mode
3. **Select Key Size**: Choose AES-128, AES-192, or AES-256 (default: 256-bit)
4. **Upload Image**: Drag and drop or click to browse for any image format (PNG, JPG, WebP, GIF, etc.)
5. **Auto-Encrypt**: The image encrypts automatically with a generated key
6. **View Encrypted Pattern**: See the visual representation of encrypted data (ECB shows patterns!)
7. **Download Results**:
   - Download the encrypted file (.enc extension)
   - Download the binary key file (no extension)
   - Download both as a ZIP bundle

**Encryption Methods:**

- **ECB (Electronic Codebook)**: Block mode - shows visual patterns in encrypted images (demonstrates ECB weakness)
- **CBC (Cipher Block Chaining)**: Chained blocks - randomized encryption with IV (secure)
- **CTR (Counter Mode)**: Stream cipher - counter-based encryption with IV (secure)

**Key Sizes:**

- **AES-128**: 128-bit key (32 hex characters) - Fast, secure for most use cases
- **AES-192**: 192-bit key (48 hex characters) - Extra security margin
- **AES-256**: 256-bit key (64 hex characters) - Maximum security (default)

### 🔓 Decryption Workflow

1. **Select Decryption Mode**: Click the "Decryption" tab or press `2`
2. **Choose AES Method**: Select the same method used for encryption
3. **Provide Key**:
   - **Option A**: Upload the binary key file (automatically detects key size and populates all fields)
   - **Option B**: Manually enter the hex key (32/48/64 characters) and IV (32 characters for CBC/CTR)
4. **Upload Encrypted File**: Drag and drop or browse for the .enc file
5. **Auto-Decrypt**: The image decrypts automatically when all inputs are ready
6. **Download Result**: Download the decrypted image in its original format

**Binary Key File Format:**

The key file uses a compact binary frame structure with no file extension:

```
Byte 0:    Key length (16, 24, or 32 bytes for AES-128/192/256)
Byte 1:    IV length (0 for ECB, 16 for CBC/CTR)
Bytes 2+:  Key bytes
Bytes N+:  IV bytes (if present)
```

**Example:**

- AES-256 with CBC: `[32][16][...32 key bytes...][...16 IV bytes...]` = 50 bytes total
- AES-128 with ECB: `[16][0][...16 key bytes...]` = 18 bytes total

### ⚖️ Comparison Workflow

1. **Select Comparison Mode**: Click the "Comparison" tab or press `3`
2. **Upload First Image**: Drag and drop or browse for Image A
3. **Upload Second Image**: Drag and drop or browse for Image B
4. **Auto-Compare**: Bit-by-bit comparison executes automatically
5. **View Results**:
   - ✅ **Identical**: Green checkmark with "100% bit-perfect match" message
   - ⚠️ **Different**: Warning icon with bit difference count and percentage
   - 📏 **Size Mismatch**: Displays both file sizes

## 🔒 Security & Validation

- **File Type Validation**: All common image formats supported (PNG, JPG, WebP, GIF, BMP, etc.)
- **File Size Limit**: Maximum 30MB per image (configurable in `app.config.ts`)
- **Key Format Validation**:
  - AES-128: 32 hex characters (16 bytes)
  - AES-192: 48 hex characters (24 bytes)
  - AES-256: 64 hex characters (32 bytes)
  - IV: 32 hex characters (16 bytes) for CBC/CTR modes
- **Binary Key File Validation**: Frame structure verification with key size detection
- **No Sensitive Data Persistence**: Keys and IVs are never stored in localStorage (destroyed on page reload)
- **Client-Side Processing**: All encryption happens in your browser via Web Workers
- **Lossless Encryption**: Bit-perfect encryption preserves all image data and metadata

**Use Cases:**

- Verify successful encryption/decryption cycle (should be 100% identical)
- Compare original image with decrypted result (bit-perfect verification)
- Validate lossless encryption (no data loss)
- Detect any file corruption or modification

## 🐧 ECB Penguin Visualization

This application demonstrates the famous "ECB penguin" vulnerability through visual encryption pattern analysis. When encrypting with ECB mode, you can see how identical blocks in the original image produce identical blocks in the encrypted output, revealing patterns even in encrypted data.

**Try it yourself:**

1. Upload an image with large solid-color areas (like the Tux penguin)
2. Select ECB encryption mode
3. Observe the encrypted image preview - patterns are visible!
4. Compare with CBC or CTR modes - they show random noise (secure)

This visualization helps understand why ECB mode is not recommended for encrypting images or data with patterns.

### 📉 Why Compressed Images Don't Show the Penguin

**Important Note**: The ECB penguin effect relies on **low entropy** and **repeating patterns** in the raw image data. Modern compressed formats like PNG and JPEG use compression algorithms (DEFLATE, DCT) that remove redundancy before storage.

**The Compression Shield:**

- **BMP/PPM (Uncompressed)**: 100 white pixels = "White" byte written 100 times → Creates repeating 16-byte blocks → ECB preserves the pattern → Penguin visible ✅
- **PNG (Compressed)**: 100 white pixels = Compressed to `"Repeat previous pixel 99 times"` → No repeating blocks → ECB encrypts unique data → Random noise only ❌

**Why PNG Encryption Fails to Show Patterns:**

1. **Compression Destroys Redundancy**: PNG's DEFLATE compression (same as ZIP files) removes the repeating blocks that ECB needs to leak patterns
2. **Dictionary Changes**: Each compressed block depends on previous data, making identical visual regions compress to different byte sequences
3. **Format Fragility**: Encrypting a PNG destroys its chunk structure (IHDR, IDAT, IEND) and CRC checksums, often resulting in "Corrupt PNG" errors

**The Math:**
```
Uncompressed: Image → Raw Pixels → ECB Encryption → Pattern Leakage
Compressed:   Image → Compression → High Entropy Data → ECB Encryption → Random Noise
```

**One Exception**: If you save a PNG with **compression level 0** (uncompressed), it behaves like BMP and the penguin reappears!

This is why the classic ECB penguin demonstration uses uncompressed formats like BMP or PPM - they preserve the raw pixel redundancy needed to visualize the encryption weakness.

## ⌨️ Keyboard Shortcuts

| Shortcut       | Action                                |
| -------------- | ------------------------------------- |
| `1`            | Switch to Encryption Mode             |
| `2`            | Switch to Decryption Mode             |
| `3`            | Switch to Comparison Mode             |
| `Ctrl/Cmd + D` | Download current output image         |
| `Tab`          | Navigate between interactive elements |
| `Enter/Space`  | Activate focused button or control    |
| `Esc`          | Clear focused input or dismiss alerts |

## 🛠️ Tech Stack

- **Runtime**: Bun (no Node.js required)
- **Framework**: React with TypeScript
- **Build Tool**: Vite 7.2 (rolldown-vite for performance)
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: Zustand with selective localStorage persistence
- **Encryption**: aes-js library for AES-128/192/256 in ECB/CBC/CTR modes
- **File Handling**: JSZip for bundle downloads
- **Utilities**: date-fns for timestamp formatting
- **Code Quality**: ESLint 9, Prettier, CodeScene, SonarCloud

## 🎯 Code Quality

This project maintains high code quality standards:

```bash
# TypeScript type checking (standard)
~/.bun/bin/bun run tsc

# TypeScript type checking (native preview - faster)
~/.bun/bin/bun run tsgo

# Linting
~/.bun/bin/bun run lint

# Linting with auto-fix
~/.bun/bin/bun run lint:fix

# Code formatting
~/.bun/bin/bun run format

# Format check only
~/.bun/bin/bun run format:check

# CodeScene analysis
~/.bun/bin/bun run codescene

# SonarQube scan (docker)
~/.bun/bin/bun run sonar-scan

# View SonarQube results
~/.bun/bin/bun run sonar-result
```

## 📱 Browser Support

- Modern browsers with ES2020+ support
- Web Workers for background processing
- Canvas API for image manipulation
- File API for drag-and-drop uploads

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run code quality checks
5. Submit a pull request

## 🙏 Acknowledgments

Built with modern web technologies to demonstrate AES encryption concepts through visual feedback and bit-perfect lossless encryption, making cryptography more accessible and understandable.

## 📄 License

This project is open source and available under the MIT License.

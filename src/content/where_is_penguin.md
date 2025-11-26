# Pixel-Data-Only Encryption (The "Tux" Hack)

## 📖 The Story: "How to Haunt an Image"
Imagine you are a cryptographer in the 1990s. You are trying to explain to a developer why **ECB mode** is dangerous. You show them math equations ($C_i = E_k(P_i)$), but their eyes glaze over.

You need something visceral. You need a ghost. 👻

You realize that if you take a simple image (like Tux the Penguin) and encrypt it blindly, the **visual patterns survive**. But there is a catch: if you encrypt the *header* (the file format info), the computer won't know it's an image anymore.

## ⚠️ The Issue: "The Header Problem"
Standard encryption turns everything into noise. If you encrypt the first few bytes of a file (the header), your image viewer will just say: **"Error: Unknown File Format."**

## 🛠️ The Workaround: "Surgical Encryption"
To demonstrate the flaw, we must perform surgery on the file.

```text
      STEP 1: THE GUILLOTINE ✂️
┌──────────────────────────────┐
│  FILE HEADER (Keep Safe)     │ ← We cut this off first!
│ "Width: 500, Height: 500"    │   (Don't encrypt it)
└──────────────┬───────────────┘
               │
┌──────────────┴───────────────┐
│  BODY (Pixel Data)           │ ← We only want this.
│  [White] [White] [Black]...  │
└──────────────┬───────────────┘
               │
      STEP 2: THE CURSE ⚙️
               │
       ┌───────┴───────┐
       │ AES-ECB Mode  │
       └───────┬───────┘
               │
      STEP 3: FRANKENSTEIN 🩹
               │
┌──────────────┴───────────────┐
│  FILE HEADER (Original)      │ ← Glue it back on!
└──────────────┬───────────────┘
┌──────────────┴───────────────┐
│  ENCRYPTED BODY              │
│  [Pattern] [Pattern] [Diff]  │
└──────────────┬───────────────┘
               │
               ▼
        🐧 GHOST IMAGE
   (Viewer reads the valid header,
    then draws the encrypted patterns!)
```

## 🔍 Why It Works
In "dumb" formats like BMP, identical colors create identical data blocks. ECB encrypts identical input to identical output.

```text
   IMAGE INPUT                 CIPHER OUTPUT
┌──────────────────────┐    ┌──────────────────┐
│ Block 1: White (FF…) │ ──►│ Block A: (9C 4B…)│
├──────────────────────┤    ├──────────────────┤
│ Block 2: White (FF…) │ ──►│ Block A: (9C 4B…)│ ⚠️ REPEATS!
└──────────────────────┘    └──────────────────┘
```
`,

  "whole-file": `# Whole-File Encryption (The "Hidden" Ghost)

## 📖 The Story: "The Broken File"
You decide to be thorough. "I won't just encrypt the pixels," you think. "I'll encrypt the *whole* file!"

You run the algorithm. You double-click the result.
**Error.** ❌
Your computer says the file is corrupted. You smile, thinking, "Perfect. It's totally secure."

## ⚠️ The Issue: "Security by Obscurity"
You haven't actually fixed the leak; you've just broken the lock. The Operating System relies on the **Header** (the first few bytes) to know how to open a file. Since you encrypted the header into garbage, the OS gives up.

## 🛠️ The Workaround: "Forced Rendering"
If a forensic analyst were to look at your "corrupted" file, they wouldn't use a standard image viewer. They would use a **Raw Renderer** that ignores headers and forces the data onto the screen.

```text
      ORIGINAL FILE
┌──────────────────────────────┐
│  HEADER (Metadata)           │
│  "I am a BMP image..."       │
├──────────────────────────────┤
│  BODY (Pixels)               │
│  [White] [White] [Black]...  │
└──────────────┬───────────────┘
               │
               ▼
       AES-ECB ENCRYPTION
    (Treats whole file as data)
               │
               ▼
      ENCRYPTED FILE
┌──────────────────────────────┐
│  GARBAGE (Encrypted Header)  │ 🚫 NO HEADER
│  [X9 F2 D1...]               │
├──────────────────────────────┤
│  ENCRYPTED BODY              │
│  [Pattern] [Pattern]...      │
└──────────────┬───────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
 STANDARD VIEWER      RAW RENDERER
┌───────────────┐   ┌───────────────┐
│ ❌ ERROR      │   │ 📺 STATIC     │ ← (The encrypted header)
│ "File Format  │   │ 📺 STATIC     │
│  Invalid"     │   │ 👻 GHOST!     │ ← (The body still leaks!)
└───────────────┘   └───────────────┘
```

**Conclusion:** The ghost is still there, hiding under a layer of broken metadata.
`,

  "compressed-disabled": `# The Mystery of the Missing Ghost

## 📖 The Story: "I Thought ECB Was Broken?"
You've read the textbooks. You know the legend: *"ECB mode leaks visual patterns!"*

So, you grab a **PNG** or **JPEG** from your hard drive. You upload it. You encrypt it. You wait for the famous Penguin Ghost to appear...
**But you just get static.** 📺

You think: *"Did I do it wrong? Is my encryption too secure? Is the textbook lying?"*

## ⚠️ The Issue: "The Compression Shield"
The textbook isn't lying, but it assumes something critical: **Redundancy**.
For ECB to show a pattern, the file needs to say "White, White, White, White".

But your PNG file is smart. It uses **Compression**. It doesn't write "White" 100 times. It writes "White x 100".
This acts like a meat grinder for patterns *before* the encryption ever happens.

```text
      PATH A: BMP (The Textbook Case)
      [ White ] [ White ] [ White ] ... (x100)
                  │
                  ▼
        [ FF... ] [ FF... ] [ FF... ]   (Repeating 16-byte Blocks)
                  │
          ECB ENCRYPTION 🔓
                  │
        [  A1  ]  [  A1  ]  [  A1  ]    (Repeating Patterns!)
                  │
                  ▼
          🐧 GHOST VISIBLE!


      PATH B: YOUR PNG (The "Smart" Case)
      [ White ] [ White ] [ White ] ... (x100)
                  │
                  ▼
        COMPRESSION ALGORITHM ⚙️
      (Removes redundancy to save space)
                  │
                  ▼
        [ "Repeat White x100" ]         (Only 3 bytes!)
                  │
        [ 01 1E FF + Random Padding ]   (One unique block)
                  │
          ECB ENCRYPTION 🔒
                  │
        [  9F 3B 2A 1C ...  ]           (Unique Noise)
                  │
                  ▼
           ░▒▓ STATIC ONLY
```

## 🛠️ The Workaround: "Making it Dumb"
To see the physics of the encryption failure, we have to disable the safety features of modern file formats.

1.  **Don't use PNG/JPG.** They are too efficient.
2.  **Convert to BMP.** This format is "dumb" and verbose. It preserves the redundancy we need.
3.  **Encrypt the BMP.** Now the ghost will return! 🐧

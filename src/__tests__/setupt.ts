
// Setup DOM environment for file operations
import { Window } from "happy-dom";
import { Canvas, Image as CanvasImage } from "canvas";

const window = new Window();
const document = window.document;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
globalThis.window = window as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
globalThis.document = document as any;

// Use node-canvas for Image and Canvas support
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
globalThis.Image = CanvasImage as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
globalThis.URL = window.URL as any;

// Patch document.createElement to return node-canvas Canvas for 'canvas' elements
const originalCreateElement = document.createElement.bind(document);
document.createElement = function (tagName: string, options?: { is?: string }) {
  if (tagName.toLowerCase() === "canvas") {
    return new Canvas(300, 150) as unknown as HTMLCanvasElement;
  }
  return originalCreateElement(tagName, options);
} as typeof document.createElement;


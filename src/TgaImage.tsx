import { useState, useEffect } from "react";
// @ts-ignore - tga-js doesn't have type declarations
import TGA from "tga-js";

interface TgaImageProps {
  src: string;
  alt: string;
  className?: string;
}

// Cache for converted TGA images
const tgaCache: Map<string, string> = new Map();

export function TgaImage({ src, alt, className }: TgaImageProps) {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTga() {
      // Check if it's a TGA file
      if (!src.toLowerCase().includes(".tga")) {
        setImageSrc(src);
        setLoading(false);
        return;
      }

      // Check cache first
      if (tgaCache.has(src)) {
        setImageSrc(tgaCache.get(src)!);
        setLoading(false);
        return;
      }

      try {
        // Fetch the TGA file
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();

        if (cancelled) return;

        // Parse the TGA file
        const tga = new TGA();
        tga.load(new Uint8Array(arrayBuffer));

        // Get the canvas and convert to data URL
        const canvas = tga.getCanvas();
        const dataUrl = canvas.toDataURL("image/png");

        // Cache the result
        tgaCache.set(src, dataUrl);

        if (!cancelled) {
          setImageSrc(dataUrl);
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to load TGA:", error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTga();

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (loading) {
    return (
      <div
        className={className}
        style={{
          backgroundColor: "#1c2128",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "0.7em", color: "#6e7681" }}>...</span>
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} className={className} />;
}

// Utility function to convert TGA to base64 for backend
export async function tgaToBase64(src: string): Promise<string> {
  // Check cache first
  if (tgaCache.has(src)) {
    return tgaCache.get(src)!;
  }

  // Fetch the TGA file
  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();

  // Parse the TGA file
  const tga = new TGA();
  tga.load(new Uint8Array(arrayBuffer));

  // Get the canvas and convert to data URL
  const canvas = tga.getCanvas();
  const dataUrl = canvas.toDataURL("image/png");

  // Cache the result
  tgaCache.set(src, dataUrl);

  return dataUrl;
}

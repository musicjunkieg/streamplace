import QR from "qrcode";
import { useEffect, useState } from "react";
import { View, ViewStyle } from "react-native";
import { SvgXml } from "react-native-svg";

interface QRCodeProps {
  value: string;
  size: number;
  background?: string;
  foreground?: string;
  style?: ViewStyle | ViewStyle[];
}

// Lightweight QR renderer using the pure-JS `qrcode` package to produce
// SVG markup, rendered through `react-native-svg`. Both are already
// dependencies — no native module needed.
export function QRCode({
  value,
  size,
  background = "#ffffff",
  foreground = "#000000",
  style,
}: QRCodeProps) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QR.toString(
      value,
      {
        type: "svg",
        margin: 1,
        color: { dark: foreground, light: background },
      },
      (err: Error | null | undefined, str: string) => {
        if (cancelled) return;
        if (err) {
          console.warn("QRCode render failed:", err);
          setSvg(null);
          return;
        }
        setSvg(str);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [value, background, foreground]);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          backgroundColor: background,
        },
        style,
      ]}
    >
      {svg ? (
        <SvgXml xml={svg} width={size} height={size} />
      ) : null}
    </View>
  );
}

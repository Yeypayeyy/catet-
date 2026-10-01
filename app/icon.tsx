// Favicon tab browser. Digambar dari logo yang sama dengan ikon PWA
// (app/ikon/struk.ts); 64px supaya tetap tajam di layar rapat.

import { ImageResponse } from "next/og";
import { dataUriStruk } from "./ikon/struk";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUriStruk()} width={64} height={64} alt="" />,
    size,
  );
}

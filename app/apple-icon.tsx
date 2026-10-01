// Ikon home screen iOS. iOS membulatkan sudutnya sendiri, jadi latarnya
// sampai tepi dan struknya sedikit dikecilkan.

import { ImageResponse } from "next/og";
import { dataUriStruk } from "./ikon/struk";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUriStruk({ penuh: true, skala: 0.82 })} width={180} height={180} alt="" />,
    size,
  );
}

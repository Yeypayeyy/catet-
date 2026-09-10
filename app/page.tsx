import { redirect } from "next/navigation";

// Sementara. Shell dan navigasi bawah menyusul di sprint terakhir Fase 2;
// sampai saat itu akar diarahkan ke layar yang paling sering dipakai.
export default function Home() {
  redirect("/review");
}

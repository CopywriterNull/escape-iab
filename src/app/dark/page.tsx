import type { Metadata } from "next";
import { Lander } from "@/components/Lander";

export const metadata: Metadata = {
  title: "Dark preview",
};

export default function DarkHome() {
  return <Lander theme="dark" />;
}

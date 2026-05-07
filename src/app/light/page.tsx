import type { Metadata } from "next";
import { Lander } from "@/components/Lander";

export const metadata: Metadata = {
  title: "Light",
};

export default function LightHome() {
  return <Lander theme="light" />;
}

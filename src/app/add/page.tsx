import type { Metadata } from "next";
import { AddVideoPage } from "@/components/add-video/AddVideoPage";

export const metadata: Metadata = {
  title: "Add Video | Gold Miner",
};

export default function AddVideo() {
  return <AddVideoPage />;
}

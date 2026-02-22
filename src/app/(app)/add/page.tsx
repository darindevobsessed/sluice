import type { Metadata } from "next"
import { Suspense } from "react"
import { AddVideoPage } from "@/components/add-video/AddVideoPage"

export const metadata: Metadata = {
  title: "Add Video | Gold Miner",
}

export default function AddVideo() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <AddVideoPage />
    </Suspense>
  )
}

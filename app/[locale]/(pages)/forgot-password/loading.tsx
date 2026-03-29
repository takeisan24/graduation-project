import CreatorHubIcon from "@/components/shared/CreatorHubIcon"

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <CreatorHubIcon className="h-10 w-10 animate-pulse" />
      </div>
    </div>
  )
}

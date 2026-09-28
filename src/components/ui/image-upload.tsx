import React, { useRef, useState } from "react"
import { UploadCloud, Image as ImageIcon, X, Loader2 } from "lucide-react"
import imageCompression from "browser-image-compression"
import { cn } from "../../lib/utils"

export interface ImageUploadProps {
  value?: string
  onChange: (base64Url?: string) => void
  // Handler for multiple compressed image batches
  onMultipleChange?: (base64Urls: string[]) => void
  onRemove?: () => void
  disabled?: boolean
  className?: string
  dark?: boolean
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  onMultipleChange,
  onRemove,
  disabled = false,
  className,
  dark = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [progress, setProgress] = useState(0)

  /**
   * Process and compress multiple or single selected files sequentially
   */
  const handleFiles = async (fileList: FileList | File[]) => {
    const validFiles = Array.from(fileList).filter(f => f.type.startsWith("image/"))
    if (validFiles.length === 0) return

    setCompressing(true)
    setProgress(10)

    const compressedResults: string[] = []

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      const options = {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 1280,
        useWebWorker: true,
        onProgress: (p: number) => {
          const stepWeight = 100 / validFiles.length
          const overallProgress = Math.round((i * stepWeight) + (p * (stepWeight / 100)))
          setProgress(overallProgress)
        },
      }

      try {
        const compressedBlob = await imageCompression(file, options)
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(compressedBlob)
        })
        compressedResults.push(base64)
      } catch {
        const base64Fallback = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        })
        compressedResults.push(base64Fallback)
      }
    }

    if (onMultipleChange) {
      onMultipleChange(compressedResults)
    } else if (compressedResults[0]) {
      onChange(compressedResults[0])
    }

    setCompressing(false)
    setProgress(0)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleClick = () => {
    if (!disabled && !compressing && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
      e.target.value = "" // Reset input so identical batch can be re-uploaded
    }
  }

  return (
    <div className={cn("relative w-full", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={handleInputChange}
      />

      {value ? (
        <div className="relative w-full h-full min-h-[140px] rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 group">
          <img
            src={value}
            alt="Uploaded preview"
            className="w-full h-full object-cover"
          />
          {onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="absolute top-2 right-2 p-1.5 rounded-xl bg-black/70 text-white hover:bg-rose-600 transition-colors shadow-md"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            "flex flex-col items-center justify-center gap-2 p-4 min-h-[120px] rounded-2xl border-2 border-dashed transition-all cursor-pointer",
            isDragging
              ? "border-emerald-500 bg-emerald-500/10"
              : "border-slate-200 dark:border-zinc-800 bg-slate-50/50 hover:bg-slate-100/80 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/60",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {compressing ? (
            <div className="flex flex-col items-center justify-center w-full px-4 text-center">
              <Loader2 className="size-5 animate-spin text-emerald-500 mb-2" />
              <div className="w-full bg-slate-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-1">
                <div
                  className="bg-emerald-500 h-full transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {progress}%
              </span>
              <span className="text-[9px] text-slate-400 dark:text-zinc-500">Compressing & Optimizing...</span>
            </div>
          ) : (
            <>
              <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-zinc-900 dark:text-zinc-400">
                {isDragging ? (
                  <UploadCloud className="size-4.5 text-emerald-500 animate-bounce" />
                ) : (
                  <ImageIcon className="size-4.5" />
                )}
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  {isDragging ? "Drop image here" : "Click to upload or drag & drop"}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  PNG, JPG or WEBP (Auto-compressed)
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
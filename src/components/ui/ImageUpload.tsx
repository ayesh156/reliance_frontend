import React, { useRef, useState } from "react"
import { UploadCloud, Image as ImageIcon, X } from "lucide-react"
import { cn } from "../../lib/utils"

export interface ImageUploadProps {
  value?: string
  onChange: (base64Url?: string) => void
  onRemove?: () => void
  disabled?: boolean
  className?: string
  dark?: boolean
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  onRemove,
  disabled = false,
  className,
  dark = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      onChange(result)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
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
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
      e.target.value = "" // Reset input so same file can be re-selected
    }
  }

  return (
    <div className={cn("relative w-full", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
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
              PNG, JPG or WEBP (Max 10MB)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
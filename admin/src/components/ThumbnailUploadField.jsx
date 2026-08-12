import React from "react";

const DEFAULT_HELPER =
  "JPG/PNG/WebP, max 5MB. Auto-compressed to ~600KB.";

export default function ThumbnailUploadField({
  label = "Stock thumbnail (optional)",
  file,
  preview,
  error,
  inputRef,
  onChange,
  onClear,
  helperText = DEFAULT_HELPER,
  className = "pt-4 mt-1 px-7",
}) {
  return (
    <div className={className}>
      <p className="text-[12px] font-medium tracking-[0.08em] text-slate-600">
        {label}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M7 17h10a4 4 0 000-8h-1a5 5 0 00-9.7 1.2A3.5 3.5 0 007 17z" />
                  <path d="M12 12v6" />
                  <path d="M9 15l3-3 3 3" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-700">
                  Upload thumbnail
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {file
                    ? `Selected: ${file.name} (${Math.round(
                        file.size / 1024
                      )}KB)`
                    : helperText}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef?.current?.click()}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
              >
                Choose file
              </button>
              {file ? (
                <button
                  type="button"
                  onClick={onClear}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onChange}
            className="sr-only"
          />
        </div>
        {preview ? (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <img
              src={preview}
              alt="Thumbnail preview"
              className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
            />
            <div className="text-[10px] text-slate-500">Preview</div>
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-[11px] text-rose-600">{error}</p>
      ) : null}
    </div>
  );
}

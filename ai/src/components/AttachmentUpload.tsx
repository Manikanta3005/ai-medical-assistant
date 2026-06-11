import React, { useRef, useState } from "react";
import { Upload, X, FileImage, ShieldAlert } from "lucide-react";
import { MessageAttachment } from "../types";

interface AttachmentUploadProps {
  attachment: MessageAttachment | null;
  onAttachmentChange: (attachment: MessageAttachment | null) => void;
}

export default function AttachmentUpload({ attachment, onAttachmentChange }: AttachmentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!file) return;

    // Check file type
    const isValidImage = file.type.startsWith("image/");
    const isValidPdf = file.type === "application/pdf";

    if (!isValidImage && !isValidPdf) {
      alert("Unsupported file format. Please upload an image (PNG, JPEG, WEBP) or a PDF report.");
      return;
    }

    // Convert file to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Content of base64 starts after the comma
      const commaIndex = base64String.indexOf(",");
      const data = commaIndex > -1 ? base64String.slice(commaIndex + 1) : base64String;

      onAttachmentChange({
        name: file.name,
        mimeType: file.type,
        data: data,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const clearAttachment = () => {
    onAttachmentChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2" id="attachment-uploader">
      {!attachment ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragging
              ? "border-emerald-500 bg-emerald-50"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          }`}
          id="dropzone"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,application/pdf"
            className="hidden"
            id="file-input"
          />
          <Upload className="w-6 h-6 text-slate-400 mb-2" />
          <p className="text-xs font-medium text-slate-700 text-center">
            Upload Medical Image, Injury Photo, or Lab Report
          </p>
          <p className="text-[10px] text-slate-400 text-center mt-1">
            Drag & drop or click to browse (PNG, JPG, PDF)
          </p>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center justify-between" id="attachment-preview">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
              <FileImage className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-medium text-slate-800 line-clamp-1 max-w-[200px]" title={attachment.name}>
                {attachment.name}
              </p>
              <p className="text-[10px] text-slate-500 uppercase">
                {attachment.mimeType.split("/")[1] || "File"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearAttachment}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-emerald-100 transition-colors"
            id="remove-attachment-btn"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Privacy reminder mandated by guidelines */}
      <div className="flex items-start gap-2 bg-amber-50/60 border border-amber-100 rounded-lg p-2 text-[11px] text-amber-800" id="privacy-reminder">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-600 mt-0.5" />
        <p>
          <strong>Privacy Alert:</strong> Do not upload documents containing unnecessary personal information such as identification numbers, passwords, banking information, or private credentials.
        </p>
      </div>
    </div>
  );
}

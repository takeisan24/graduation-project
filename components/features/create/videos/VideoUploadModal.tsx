"use client";

import { useState, useEffect } from "react";
import { X as CloseIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MEDIA_ERRORS } from "@/lib/messages/errors";

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, options: { language: string, multiSpeaker: boolean, translate: boolean }) => void;
}

export function VideoUploadModal({ isOpen, onClose, onUpload }: VideoUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("Vietnamese");
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [multiSpeaker, setMultiSpeaker] = useState(false);
  const [translateCaptions, setTranslateCaptions] = useState(false);

  // Reset state khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
      setVideoPreview(null);
    }
  }, [isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file);
      const videoUrl = URL.createObjectURL(file);
      setVideoPreview(videoUrl);
    } else {
      toast.error(MEDIA_ERRORS.INVALID_VIDEO_FILE);
    }
  };

  const handleDeleteFile = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setSelectedFile(null);
    setVideoPreview(null);
  };

  const handleConfirmUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile, {
        language: selectedLanguage,
        multiSpeaker: multiSpeaker,
        translate: translateCaptions,
      });
      onClose(); // Modal sẽ được đóng bởi component cha
    }
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#2A2A30] border border-[#E33265]/80 rounded-lg p-8 w-[700px] max-w-[95vw] shadow-xl relative" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors">
          <CloseIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between mb-6">
          {selectedFile ? (
            <button onClick={handleDeleteFile} className="text-white/60 hover:text-white text-2xl font-light transition-colors" aria-label="Quay lại">←</button>
          ) : <div className="w-8"></div>}
          <h3 className="text-xl font-semibold text-white">Generate captions with AI</h3>
          <div className="w-8"></div>
        </div>
        
        {!selectedFile ? (
          <>
            <div className="flex justify-center mb-6">
              <button className="w-1/2 flex items-center justify-center gap-2 p-3 border border-[#E33265]/80 rounded-lg text-white hover:bg-white/5 transition-colors text-sm">
                <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-green-500 rounded flex items-center justify-center text-white text-xs font-bold">G</div>
                Import from Google Drive
              </button>
            </div>
            <div className="border-2 border-dashed border-[#E33265]/80 rounded-lg p-12 text-center mb-6 relative hover:bg-white/5 transition-colors">
              <div className="w-16 h-16 bg-orange-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <p className="text-white text-lg mb-2">Drop or <span className="text-[#E33265] underline">browse your video</span></p>
              <p className="text-gray-400 text-sm">MP4 or MOV, Max duration: 5.00 min, Max size: 2GB</p>
              <input type="file" accept="video/mp4,video/quicktime,video/x-matroska" onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            </div>
            <div className="flex items-center justify-center gap-4">
              <p className="text-white text-sm">Or try this sample video</p>
              <span className="text-lg">👉</span>
              <div className="flex items-center gap-3 bg-[#1A0F30] border border-[#E33265]/80 rounded-lg p-3 flex-1 cursor-pointer hover:border-[#E33265]">
                <div className="w-16 h-12 bg-gray-700 rounded flex items-center justify-center"><div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center"><svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div></div>
                <div><p className="text-white text-sm font-medium">Welcome to Maiovo</p><p className="text-gray-400 text-xs">32s</p></div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="relative mb-6">
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                <video src={videoPreview || undefined} className="w-full h-full object-contain" controls autoPlay />
              </div>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-white text-sm">Language</span>
                <div className="relative">
                  <button onClick={() => setShowLanguageDropdown(!showLanguageDropdown)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <span className="text-white text-sm">{selectedLanguage}</span>
                    <div className="w-6 h-4 bg-red-600 rounded flex items-center justify-center"><span className="text-white text-xs">{selectedLanguage === "Vietnamese" ? "VN" : "US"}</span></div>
                    <svg className={`w-4 h-4 text-white transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showLanguageDropdown && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-[#2A2A30] border border-white/10 rounded-lg shadow-lg z-10" onMouseLeave={() => setShowLanguageDropdown(false)}>
                      <button onClick={() => { setSelectedLanguage("Vietnamese"); setShowLanguageDropdown(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors"><div className="w-6 h-4 bg-red-600 rounded flex items-center justify-center"><span className="text-white text-xs">VN</span></div><span className="text-white">Vietnamese</span></button>
                      <button onClick={() => { setSelectedLanguage("English"); setShowLanguageDropdown(false); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors"><div className="w-6 h-4 bg-blue-600 rounded flex items-center justify-center"><span className="text-white text-xs">US</span></div><span className="text-white">English</span></button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="text-white text-sm">Multi-Speaker theme</span><div className="w-4 h-4 bg-gray-600 rounded-full flex items-center justify-center cursor-help" title="Nhận diện nhiều người nói khác nhau"><span className="text-white text-xs">i</span></div></div>
                <button onClick={() => setMultiSpeaker(!multiSpeaker)} className={`w-12 h-6 rounded-full transition-colors ${multiSpeaker ? 'bg-[#E33265]' : 'bg-gray-600'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform ${multiSpeaker ? 'translate-x-6' : 'translate-x-0.5'}`}></div></button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="text-white text-sm">Translate Captions</span><div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center cursor-help" title="Dịch phụ đề sang ngôn ngữ khác"><svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div></div>
                <button onClick={() => setTranslateCaptions(!translateCaptions)} className={`w-12 h-6 rounded-full transition-colors ${translateCaptions ? 'bg-[#E33265]' : 'bg-gray-600'}`}><div className={`w-5 h-5 bg-white rounded-full transition-transform ${translateCaptions ? 'translate-x-6' : 'translate-x-0.5'}`}></div></button>
              </div>
            </div>
            <Button onClick={handleConfirmUpload} className="w-full bg-[#E33265] text-white py-3 rounded-lg hover:bg-[#E33265]/80 font-medium">Generate captions</Button>
          </>
        )}
      </div>
    </div>
  );
}
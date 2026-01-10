"use client";

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlayIcon, FilmIcon, Sparkles } from "lucide-react"; // Added Sparkles
import { useMemo, useState } from "react"; // Added useState
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge"; // Added Badge
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"; // Added Dialog components
import { Button } from "@/components/ui/button"; // Added Button

import type { VideoProject } from "@/store";

interface VideoProjectListProps {
  projects: VideoProject[];
  searchTerm: string;
  onEdit: (projectId: string) => void;
  onAddNew: () => void;
  onDelete: (projectId: string) => void;
  onPlay: (project: VideoProject) => void;
}

export function VideoProjectList({ projects, searchTerm, onEdit, onAddNew, onDelete, onPlay }: VideoProjectListProps) {
  const t = useTranslations('CreatePage.videosSection');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filteredProjects = useMemo(() =>
    projects.filter(project =>
      project.title.toLowerCase().includes(searchTerm.toLowerCase())
    ), [projects, searchTerm]);

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(projectId);
  };

  const handleConfirmDelete = () => {
    if (confirmDeleteId) {
      onDelete(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredProjects.map((project) => (
          <Card
            key={project.id}
            className="bg-[#180F2E] border-[#E33265]/80 p-0 overflow-hidden hover:bg-[#EA638A]/20 hover:border-[#EA638A] hover:scale-[1.03] transition-all duration-200 cursor-pointer group"
            onClick={() => {
              if (project.videoUrl && project.status === 'completed') {
                onPlay(project);
              } else {
                onEdit(project.id);
              }
            }}
          >
            <div className="relative w-full aspect-video bg-gray-800/50 overflow-hidden">
              {project.thumbnail ? (
                <img src={project.thumbnail} alt={project.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PlayIcon className="w-8 h-8 text-gray-400 transition-transform group-hover:scale-110" />
                </div>
              )}

              {/* ✅ NEW: Project Type Badge */}
              <div className="absolute top-2 left-2 z-20">
                {project.type === 'text-to-video' ? (
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 border-none text-white gap-1 px-2 py-0.5 text-[10px] font-medium shadow-sm hover:from-purple-600 hover:to-pink-600">
                    <Sparkles className="w-3 h-3" />
                    Text to Video
                  </Badge>
                ) : (
                  <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 border-none text-white gap-1 px-2 py-0.5 text-[10px] font-medium shadow-sm hover:from-blue-600 hover:to-cyan-600">
                    <FilmIcon className="w-3 h-3" />
                    Video Factory
                  </Badge>
                )}
              </div>

              <div
                className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full border border-black/20 ${project.status === 'completed' ? 'bg-green-500' : project.status === 'processing' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                title={`Status: ${project.status}`}
              />
              <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
                <div className="bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                  {project.duration}
                </div>
                {project.status === 'processing' && (
                  <div className="flex-1">
                    <Progress value={project.progress ?? 0} className="bg-white/10 h-2" />
                  </div>
                )}
              </div>
            </div>
            <div className="p-3">
              <h3 className="text-sm font-medium text-white truncate mb-1 group-hover:text-white">{project.title}</h3>
              <p className="ext-xs text-gray-400 group-hover:text-gray-300 transition-colors">
                {(() => {
                  const d = new Date(project.createdAt);
                  const dateStr = d.toLocaleDateString('vi-VN');
                  // Custom Time Format: 0 for midnight (00:xx), 12 for noon (12:xx)
                  const hours = d.getHours();
                  const minutes = d.getMinutes().toString().padStart(2, '0');
                  const seconds = d.getSeconds().toString().padStart(2, '0');
                  const ampm = hours >= 12 ? 'PM' : 'AM';
                  const displayHour = hours === 0 ? 0 : (hours > 12 ? hours - 12 : hours);

                  return `${dateStr} - ${displayHour}:${minutes}:${seconds} ${ampm}`;
                })()}
              </p>
              {project.status === 'processing' && (
                <div className="mt-2 text-xs text-white/70 flex justify-between">
                  <span>{project.progressMessage || 'Đang xử lý...'}</span>
                  <span>{Math.round(project.progress ?? 0)}%</span>
                </div>
              )}
            </div>
            <button
              onClick={(e) => handleDeleteClick(e, project.id)}
              className="absolute top-2 right-8 z-10 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white/70 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 hover:text-white transition-all"
              title={t('deleteProject')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
          </Card>
        ))}
        {/* ✅ DISABLE: Click disabled as per user request */}
        <Card
          className="bg-[#180F2E] border-2 border-dashed border-[#E33265]/30 p-0 overflow-hidden flex items-center justify-center aspect-video group opacity-50 cursor-default"
        >
          <div className="text-center text-gray-600 transition-colors">
            <FilmIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">{t('uploadVideo')}</p>
          </div>
        </Card>
      </div>

      {/* ✅ NEW: Delete Confirmation Modal */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="bg-[#150A25] border-[#E33265]/20 text-white sm:max-w-[425px] p-0 overflow-hidden shadow-2xl">
          <div className="p-6 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 ring-1 ring-red-500/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 w-6 h-6"><path d="M3 6h18" /><path d="M19 6v14c0 1-2 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
            </div>
            <DialogHeader className="mb-2">
              <DialogTitle className="text-xl font-bold text-center">Xác nhận xóa dự án</DialogTitle>
              <DialogDescription className="text-slate-300 text-center mt-2 leading-relaxed">
                Bạn có chắc muốn delete project này không? <br />
                <span className="text-red-400 font-medium">Tất cả các thông tin liên quan sẽ bị xóa theo.</span>
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="bg-black/20 p-4 gap-3 sm:gap-0 border-t border-white/5">
            <Button
              variant="ghost"
              onClick={() => setConfirmDeleteId(null)}
              className="hover:bg-white/10 text-white border border-white/10 flex-1 sm:flex-none"
            >
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white flex-1 sm:flex-none shadow-lg shadow-red-900/20"
            >
              Xóa vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

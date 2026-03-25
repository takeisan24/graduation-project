"use client"

import { Sparkles } from "lucide-react"

export default function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-bold">CreatorHub</span>
          </div>

          {/* Project info */}
          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Đồ án tốt nghiệp — Ngành Công nghệ Thông tin</p>
            <p>Sinh viên: Vũ Tuấn Anh — CNTT4</p>
          </div>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} CreatorHub
          </p>
        </div>
      </div>
    </footer>
  )
}

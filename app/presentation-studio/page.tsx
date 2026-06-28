"use client";

import { useEffect, useState } from "react";
import { PresentationStudioWorkspace } from "@/components/presentation-studio/PresentationStudioWorkspace";
import { usePresentationStudio } from "@/lib/presentation-studio/store";

export default function PresentationStudioPage() {
  const { documents, activeDocumentId, createDocument, setActiveDocument } = usePresentationStudio();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // 手动触发hydration（因为使用了skipHydration）
    usePresentationStudio.persist.rehydrate();
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    // 如果没有活动文档，创建一个新的
    if (!activeDocumentId && documents.length === 0) {
      const newDoc = createDocument("新演示文稿");
      setActiveDocument(newDoc.id);
    } else if (!activeDocumentId && documents.length > 0) {
      // 激活第一个文档
      setActiveDocument(documents[0].id);
    }
  }, [isHydrated, activeDocumentId, documents, createDocument, setActiveDocument]);

  if (!isHydrated) {
    return null; // 或者显示loading状态
  }

  return <PresentationStudioWorkspace />;
}

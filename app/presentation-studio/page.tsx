"use client";

import { useEffect } from "react";
import { PresentationStudioWorkspace } from "@/components/presentation-studio/PresentationStudioWorkspace";
import { usePresentationStudio } from "@/lib/presentation-studio/store";

export default function PresentationStudioPage() {
  const { documents, activeDocumentId, createDocument, setActiveDocument } = usePresentationStudio();

  useEffect(() => {
    // 如果没有活动文档，创建一个新的
    if (!activeDocumentId && documents.length === 0) {
      const newDoc = createDocument("新演示文稿");
      setActiveDocument(newDoc.id);
    } else if (!activeDocumentId && documents.length > 0) {
      // 激活第一个文档
      setActiveDocument(documents[0].id);
    }
  }, [activeDocumentId, documents, createDocument, setActiveDocument]);

  return <PresentationStudioWorkspace />;
}

#!/usr/bin/env node
/**
 * LipCoding Demo PDF Generator
 * Run: node demo/generate-demo-pdf.mjs
 * Creates demo/sample-korean-report.pdf and demo/sample-english-report.pdf
 */

import PDFDocument from "pdfkit";
import { createWriteStream } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createPdf(filename, lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60 });
    const out = createWriteStream(join(__dirname, filename));
    doc.pipe(out);
    out.on("finish", resolve);
    out.on("error", reject);

    for (const line of lines) {
      if (line.startsWith("# ")) {
        doc.fontSize(18).font("Helvetica-Bold").text(line.slice(2)).moveDown(0.5);
      } else if (line.startsWith("## ")) {
        doc.fontSize(13).font("Helvetica-Bold").text(line.slice(3)).moveDown(0.3);
      } else if (line.startsWith("- ")) {
        doc.fontSize(11).font("Helvetica").text(`• ${line.slice(2)}`, { indent: 20 });
      } else if (line === "") {
        doc.moveDown(0.4);
      } else {
        doc.fontSize(11).font("Helvetica").text(line);
      }
    }

    doc.end();
  });
}

// English demo PDF
await createPdf("sample-project-brief.pdf", [
  "# Project Brief: LipCoding AI Assistant",
  "",
  "## Overview",
  "LipCoding is a personal productivity assistant that captures notes, tasks, and events",
  "using text, voice, and file input. AI processes and organizes everything automatically.",
  "",
  "## Timeline",
  "- MVP completion: July 1, 2026",
  "- Beta testing: July 15, 2026",
  "- Production launch: August 1, 2026",
  "",
  "## Action Items",
  "- Complete multimodal input implementation by June 25",
  "- Deploy to Azure Container Apps by June 28",
  "- Write user documentation by June 30",
  "- Schedule demo with stakeholders for next Friday",
  "",
  "## Budget",
  "Azure infrastructure budget: $500/month estimated.",
  "Need CFO approval before provisioning Cosmos DB — follow up by end of week.",
]);

console.log("✅ Created demo/sample-project-brief.pdf");

// Korean demo PDF
await createPdf("sample-korean-brief.pdf", [
  "# LipCoding 프로젝트 개요",
  "",
  "## 소개",
  "LipCoding은 텍스트, 음성, 파일 입력을 통해 메모, 할 일, 일정을 캡처하는",
  "개인 생산성 어시스턴트입니다. AI가 자동으로 정리하고 저장합니다.",
  "",
  "## 일정",
  "- MVP 완료: 2026년 7월 1일",
  "- 베타 테스트: 2026년 7월 15일",
  "- 정식 출시: 2026년 8월 1일",
  "",
  "## 할 일 목록",
  "- 멀티모달 입력 구현 완료 (6월 25일까지)",
  "- Azure Container Apps 배포 (6월 28일까지)",
  "- 사용자 문서 작성 (6월 30일까지)",
  "- 다음 주 금요일 이해관계자 데모 일정 잡기",
  "",
  "## 예산",
  "Azure 인프라 예산: 월 $500 예상.",
  "Cosmos DB 프로비저닝 전 CFO 승인 필요 - 이번 주 말까지 후속 조치 필요.",
]);

console.log("✅ Created demo/sample-korean-brief.pdf");
console.log("\n📂 Demo files ready in the demo/ directory:");
console.log("  - demo/sample-project-brief.pdf  (English)");
console.log("  - demo/sample-korean-brief.pdf   (Korean)");
console.log("  - demo/meeting-notes-2026-06-20.txt  (English text)");
console.log("  - demo/회의록_2026-06-20.txt          (Korean text)");

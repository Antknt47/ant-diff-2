import * as fs from 'fs';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createHash } from 'crypto';

export function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export async function extractTextFromPdf(pdfPath) {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const pdfData = new Uint8Array(pdfBuffer);
  const pdf = await getDocument({ data: pdfData }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(' ');
  }

  return fullText;
}

export function hashString(input) {
  return createHash('sha256').update(input).digest('hex');
}
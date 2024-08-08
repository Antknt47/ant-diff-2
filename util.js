import * as fs from 'fs';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createHash } from 'crypto';
import { diffChars, createPatch } from "diff";

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

export function getDiffRate(oldStr, newStr) {
  // Output result
  const diff = diffChars(oldStr, newStr);

  let totalDiff = 0;
  diff.forEach(part => {
  if (part.added || part.removed) {
          totalDiff += part.value.length;
      }
  });
  
  const maxLength = Math.max(oldStr.length, newStr.length);
  const differenceRate = maxLength > 0 ? ((totalDiff / maxLength) * 100).toFixed(2) : 0;
  return differenceRate;
}
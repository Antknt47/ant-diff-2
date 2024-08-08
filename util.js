import * as fs from 'fs';
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createHash } from 'crypto';
import { diffChars, createPatch } from "diff";
import pdfPoppler from 'pdf-poppler';
import * as Diff2HTML from "diff2html";

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
    fullText += textContent.items.map(item => `${item.str}`).join('\n');
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

export async function convertPdfToImage(pdfPath, outputFolder, fileName) {
  const options = {
    format: 'png',
    out_dir: outputFolder,
    out_prefix: fileName,
    page: null
  };

  await pdfPoppler.convert(pdfPath, options);
}

export function getDiffReport (oldStr, newStr, name) {
  const diffString = createPatch(name, oldStr, newStr);
  const diffHTML = Diff2HTML.html(diffString, {    drawFileList: false,
    fileListToggle: false,
    fileListStartVisible: false,
    fileContentToggle: false,
    matching: 'lines',
    outputFormat: 'side-by-side',
    synchronisedScroll: true,
    highlight: true,
    renderNothingWhenEmpty: false,
  });

  const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <link rel="stylesheet" href="./assert/github.min.css" />
        <link
          rel="stylesheet"
          type="text/css"
          href="./assert/diff2html.min.css"
        />
        <script type="text/javascript" src="./assert/diff2html-ui.min.js"></script>
      </head>
      <body>
          <div id="diff-container">${diffHTML}</div>
          <script src="./assets/diff2html.min.js"></script>
          <script>
              const diffHtml = document.getElementById('diff-container').innerHTML;
              const diffContainer = document.getElementById('diff-container');
              diffContainer.innerHTML = Diff2Html.html(diffHtml, { drawFileList: true, outputFormat: 'side-by-side' });
          </script>
      </body>
      </html>
    `;

    return htmlContent;
}

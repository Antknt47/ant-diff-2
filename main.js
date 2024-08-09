import * as fs from 'fs';
import * as path from 'path';
import * as util from './util.js';
import ExcelJS from 'exceljs';

import config from './config.js';

// console.log(config);

// Target list
let rltArr = [];

(async function process() {

    // Read new and old PDF files
    const newPDFs = fs.readdirSync(config.new).filter(file => file.endsWith('.pdf'));
    const oldPDFs = fs.readdirSync(config.old).filter(file => file.endsWith('.pdf'));

    // Create a map for old PDFs with their hashes
    const oldMap = new Map();
    for (const pdf of oldPDFs) {
        const pdfText = await util.extractTextFromPdf(path.join(config.old, pdf));
        const visibleText = pdfText.replace(/[\s\u200B-\u200D\uFEFF]/g, ''); // Remove spaces and zero-width characters
        const hash = util.hashString(visibleText);
        oldMap[hash] = pdf;
    }

    // Process new PDFs and compare with old PDFs
    for (const pdf of newPDFs) {
        // New files
        const newName = pdf.split('.')[0];
        const newPDFText = await util.extractTextFromPdf(path.join(config.new, pdf));
        const newVisibleText = newPDFText.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
        const newHash = util.hashString(newVisibleText);
        const newOutputFiles = fs.readdirSync(config.new).filter(file => RegExp(newName).test(file));

        // Find old PDF
        const oldpdf = oldMap[newHash];

        if(oldpdf === undefined) {
            console.warn(`${pdf} : Pair file cannot found.`);
            continue;
        }

        // Get old name
        const oldName = oldpdf.split('.')[0];

        // Get new json from old folder.
        const newJson = oldpdf.split('.')[0] + '.json';
        const oldPDFText = await util.extractTextFromPdf(path.join(config.old, oldpdf));
        const oldVisibleText = newPDFText.replace(/[\s\u200B-\u200D\uFEFF]/g, '');

        // Create an object with test pair information
        let obj = {
            // new
            newName: newName,
            newPDF: path.join(config.new, pdf),
            newPDFText: newPDFText,
            newVisibleText: newVisibleText,
            newFiles: [
                ...(newOutputFiles.map(str => path.join(config.new, str))),
                path.join(config.old, newJson)
            ],
            newHash: newHash,

            // old
            oldName: oldName,
            oldPDF: path.join(config.old, oldpdf),
            oldPDFText: oldPDFText,
            oldVisibleText: oldVisibleText,
            oldFiles: [
                path.join(config.old, oldpdf),
            ],

        };
        rltArr.push(obj);
        // console.log(obj);
    }

    // Ensure the result directory exists
    util.ensureDir(config.result);

    for (const rlt of rltArr) {
        const rltFolder = `${config.result}/${rlt.newName}`;
        const genkouFolder = `${config.result}/${rlt.newName}/1_現行`;
        const shinkiFolder = `${config.result}/${rlt.newName}/2_新規`;
        const kekkaFolder = `${config.result}/${rlt.newName}/3_比較結果`;

        util.ensureDir(rltFolder);
        util.ensureDir(genkouFolder);
        util.ensureDir(shinkiFolder);
        util.ensureDir(kekkaFolder);

        // ------ OLD -------
        // Copy old files to genkouFolder
        for (const oldFile of rlt.oldFiles) {
            const sourcePath = oldFile;
            const destPath = path.join(genkouFolder, path.basename(oldFile));
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
            } else {
                console.warn(`Warning: ${sourcePath} does not exist.`);
            }
        }
        // Output old text to genkouFolder
        fs.writeFileSync( path.join(genkouFolder, `${rlt.oldName}.txt`), rlt.oldPDFText);
        // Convert old PDF to PNGs
        util.convertPdfToImage(rlt.oldPDF, genkouFolder, rlt.oldName);


        // ------ NEW -------
        // Copy new files to shinkiFolder
        for (const newFile of rlt.newFiles) {
            const sourcePath = newFile;
            const destPath = path.join(shinkiFolder, path.basename(newFile));
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
            } else {
                console.warn(`Warning: ${sourcePath} does not exist.`);
            }
        }
        // Output new text to shinkiFolder
        fs.writeFileSync(path.join(shinkiFolder, `${rlt.newName}.txt`), rlt.newPDFText);
        // Convert old PDF to PNGs
        util.convertPdfToImage(rlt.newPDF, shinkiFolder, rlt.newName);

        // ------ Output result ------
        const differenceRate = util.getDiffRate(rlt.oldPDFText, rlt.newPDFText);
        const differenceRateVisible = util.getDiffRate(rlt.oldVisibleText, rlt.newVisibleText);
        let csvContentPdfLib = 'File,From length,To length,Char diff(%),Visible diff(%)\n'; // CSV head
        csvContentPdfLib += 
            `${rlt.newName},${rlt.oldPDFText.length},${rlt.newPDFText.length},${differenceRate.toFixed(2)},${differenceRateVisible.toFixed(2)}\n`;
        // Write csv
        fs.writeFileSync(path.join(kekkaFolder, `result.csv`), csvContentPdfLib);
        console.log(`${rlt.newName}Difference rate: ${differenceRate}%`);

        // Write excel
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile('./templete.xlsx');
            // Report sheet
            const reportWorkSheet = workbook.getWorksheet('差分レポート');

            const table = reportWorkSheet.addTable({
                name: 'Table1',
                ref: 'A1',
                headerRow: true,
                totalsRow: false,
                columns: [
                    { name: 'ファイル名' },
                    { name: '文字数（旧）' },
                    { name: '文字数（新）' },
                    { name: '文字差異率(%)' },
                    { name: '可視文字差異率(%)' }
                ],
                rows: [
                    [rlt.newName, rlt.oldPDFText.length, rlt.newPDFText.length, differenceRate, differenceRateVisible],
                ],
                style: {
                    theme: 'TableStyleMedium2',
                    showFirstColumn: false,
                    showLastColumn: false,
                    showRowStripes: true,
                    showColumnStripes: false,
                }
            });

            reportWorkSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    if (colNumber === 1) {
                        cell.alignment = { horizontal: 'left' };
                    }
                    if (rowNumber === 1) { // 第一行
                        cell.style.font = {
                            name: 'Yu Gothic', // 设置字体
                            family: 4, // 字体家族，4 表示无衬线体
                            size: 12, // 字体大小
                            bold: true, // 标题加粗
                            color: { argb: 'FFFFFFFF' } // 字体颜色（白色）
                        };
                        cell.alignment = { horizontal: 'left' };
                    } else { // 其他行
                        cell.style.font = {
                            name: 'Yu Gothic', // 设置字体
                            family: 4, // 字体家族，4 表示无衬线体
                            size: 12, // 字体大小
                            color: { argb: 'FF000000' } // 字体颜色（黑色）
                        };
                    }
                });
            });

            await workbook.xlsx.writeFile("./test.xlsx");
        } catch (err) {
            console.error('error:', err);
        }

        const reportHTML = util.getDiffReport(rlt.oldPDFText, rlt.newPDFText, rlt.newName);
        fs.writeFileSync(path.join(kekkaFolder, `${rlt.newName}.html`), reportHTML);
        util.ensureDir(`${kekkaFolder}/assert`);
        fs.copyFileSync("./assert/diff2html-ui.min.js",`${kekkaFolder}/assert/diff2html-ui.min.js`);
        fs.copyFileSync("./assert/diff2html.min.css",`${kekkaFolder}/assert/diff2html.min.css`);
        fs.copyFileSync("./assert/diff2html.min.js",`${kekkaFolder}/assert/diff2html.min.js`);
        fs.copyFileSync("./assert/github.min.css",`${kekkaFolder}/assert/github.min.css`);
        
    }
})();

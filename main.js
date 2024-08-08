import * as fs from 'fs';
import * as path from 'path';

import * as util from './util.js';

import config from './config.js';

console.log(config);

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
        const name = pdf.split('.')[0];
        const pdfText = await util.extractTextFromPdf(path.join(config.new, pdf));
        const visibleText = pdfText.replace(/[\s\u200B-\u200D\uFEFF]/g, ''); // Remove spaces and zero-width characters
        const hash = util.hashString(visibleText);
        const oldpdf = oldMap[hash];
        const newJson = oldpdf.split('.')[0] + '.json';
        const newOutputFiles = fs.readdirSync(config.new).filter(file => RegExp(name).test(file));

        // Create an object with relevant information
        let obj = {
            name: name,
            text: pdfText,
            visibleText: visibleText,
            hash: hash,
            oldFiles: [
                path.join(config.old, oldpdf),
            ],
            newFiles: [
                ...(newOutputFiles.map(str => path.join(config.new, str))),
                path.join(config.old, newJson)
            ]
        };
        rltArr.push(obj);
        console.log(obj);
    }

    // Ensure the result directory exists
    util.ensureDir(config.result);

    for (const rlt of rltArr) {
        const rltFolder = `${config.result}/${rlt.name}`;
        const genkouFolder = `${config.result}/${rlt.name}/1.現行`;
        const shinkiFolder = `${config.result}/${rlt.name}/2.新規`;
        const kekkaFolder = `${config.result}/${rlt.name}/3.結果`;

        util.ensureDir(`${config.result}/${rlt.name}`);
        util.ensureDir(genkouFolder);
        util.ensureDir(shinkiFolder);
        util.ensureDir(kekkaFolder);

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
    }
})();

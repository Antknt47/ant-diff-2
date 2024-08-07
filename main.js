import * as fs from 'fs';
import * as path from 'path';

import * as util from './util.js';

import config from './config.js';

console.log(config);
// Target list
let rltArr = [];

(async function process() {

    // Make the unit for test process.
    const newPDFs = fs.readdirSync(config.new).filter(file => file.endsWith('.pdf'));
    const oldPDFs = fs.readdirSync(config.old).filter(file => file.endsWith('.pdf'));

    const oldMap = new Map();
    for (const pdf of oldPDFs) {
        const pdfText = await util.extractTextFromPdf(path.join(config.old, pdf))
        const visibleText = pdfText.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
        const hash = util.hashString(visibleText);
        oldMap[hash] = pdf;
    }
    for (const pdf of newPDFs) {
        const name = pdf.split('.')[0];
        const pdfText = await util.extractTextFromPdf(path.join(config.new, pdf))
        const visibleText = pdfText.replace(/[\s\u200B-\u200D\uFEFF]/g, '');
        const hash = util.hashString(visibleText);
        const oldpdf = oldMap[hash];
        const oldJson = oldpdf.split('.')[0] + '.json';
        const newOutputFiles = fs.readdirSync(config.new).filter(file => RegExp(name).test(file));
        let obj = {
            name: name,
            text: pdfText,
            visibleText: visibleText,
            hash: hash,
            oldFiles: [
                oldpdf,
                oldJson,
            ],
            newFiles: [
                ...newOutputFiles
            ]
        };
        rltArr.push(obj);
        console.log(obj);
    }
    util.ensureDir(config.result);
    for(const rlt of rltArr) {
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
            const sourcePath = path.join(config.old, oldFile);
            const destPath = path.join(genkouFolder, oldFile);
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
            } else {
                console.warn(`Warning: ${sourcePath} does not exist.`);
            }
        }

        // Copy new files to shinkiFolder
        for (const newFile of rlt.newFiles) {
            const sourcePath = path.join(config.new, newFile);
            const destPath = path.join(shinkiFolder, newFile);
            if (fs.existsSync(sourcePath)) {
                fs.copyFileSync(sourcePath, destPath);
            } else {
                console.warn(`Warning: ${sourcePath} does not exist.`);
            }
        }
    }
})();
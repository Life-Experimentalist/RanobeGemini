const fs = require('fs');
const path = require('path');

function processFile(filePath) {
    const original = fs.readFileSync(filePath, 'utf8');
    let modified = '';
    let changed = false;
    let i = 0;
    while (i < original.length) {
        let cp = original.codePointAt(i);
        if (cp > 127) {
            let char = String.fromCodePoint(cp);
            modified += '\\u{' + cp.toString(16).toUpperCase() + '}';
            changed = true;
            i += char.length;
        } else {
            modified += original[i];
            i++;
        }
    }
    if (changed) {
        fs.writeFileSync(filePath, modified, 'utf8');
        console.log('Fixed encoding escape in:', filePath);
    }
}

function walkUrl(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (let entry of entries) {
        let fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && !['node_modules', '.git', 'releases', 'dist'].includes(entry.name)) {
            walkUrl(fullPath);
        } else if (/\.(js)$/.test(entry.name)) {
            processFile(fullPath);
        }
    }
}
walkUrl('src');

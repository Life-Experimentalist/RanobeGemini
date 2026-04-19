const fs = require('fs');
const path = require('path');
const cp = {'0x20AC': 0x80, '0x201A': 0x82, '0x0192': 0x83, '0x201E': 0x84, '0x2026': 0x85, '0x2020': 0x86, '0x2021': 0x87, '0x02C6': 0x88, '0x2030': 0x89, '0x0160': 0x8A, '0x2039': 0x8B, '0x0152': 0x8C, '0x017D': 0x8E, '0x2018': 0x91, '0x2019': 0x92, '0x201C': 0x93, '0x201D': 0x94, '0x2022': 0x95, '0x2013': 0x96, '0x2014': 0x97, '0x02DC': 0x98, '0x2122': 0x99, '0x0161': 0x9A, '0x203A': 0x9B, '0x0153': 0x9C, '0x017E': 0x9E, '0x0178': 0x9F};
function fixSync(fp) {
    let t = fs.readFileSync(fp, 'utf8');
    let r = '', i = 0, chg = false;
    while(i < t.length) {
        let c = t.charCodeAt(i);
        let cHex = '0x'+c.toString(16).toUpperCase();
        let b = c <= 0xFF ? c : cp[cHex];
        if (b !== undefined && b >= 0xC2 && b <= 0xF4) {
            let L = b >= 0xF0 ? 4 : (b>=0xE0?3:2);
            let seq = t.substring(i, i+L);
            if (seq.length === L) {
                let arr = [];
                for(let k=0;k<L;k++) {
                    let sc = seq.charCodeAt(k);
                    let sb = sc<=0xFF ? sc : cp['0x'+sc.toString(16).toUpperCase()];
                    if(sb===undefined) { arr=null; break; }
                    arr.push(sb);
                }
                if (arr) {
                    let dec = Buffer.from(arr).toString('utf8');
                    if (!dec.includes('\uFFFD') && Array.from(dec).length < L && dec.charCodeAt(0) > 127) {
                        r += dec;
                        i += L;
                        chg = true;
                        continue;
                    }
                }
            }
        }
        r += t[i];
        i++;
    }
    if (chg && r !== t) {
        fs.writeFileSync(fp, r, 'utf8');
        console.log('Fixed:', fp);
    }
}
function walk(d) {
    for(let e of fs.readdirSync(d, {withFileTypes:true})) {
        let p = path.join(d, e.name);
        if (e.isDirectory() && !['node_modules','.git','releases','graphify-out', 'dev'].includes(e.name)) {
            walk(p);
        } else if (/\.(html|js|css|md|json)$/.test(p)) {
            try { fixSync(p); } catch(err) {}
        }
    }
}
walk('.');

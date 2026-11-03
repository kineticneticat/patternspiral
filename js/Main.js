"use strict";
const edgeLength = 16;
const padding = 5;
const strokeStyle = "black";
const curvePercent = 0.2;
const markWidth = 5;
// const canvas = document.getElementById("canvas")! as HTMLCanvasElement
// const ctx = canvas.getContext("2d")!
var StartDir;
(function (StartDir) {
    StartDir["EAST"] = "EAST";
    StartDir["SOUTH_EAST"] = "SOUTH_EAST";
    StartDir["SOUTH_WEST"] = "SOUTH_WEST";
    StartDir["WEST"] = "WEST";
    StartDir["NORTH_WEST"] = "NORTH_WEST";
    StartDir["NORTH_EAST"] = "NORTH_EAST";
})(StartDir || (StartDir = {}));
const sdToNum = [StartDir.EAST, StartDir.SOUTH_EAST, StartDir.SOUTH_WEST, StartDir.WEST, StartDir.NORTH_WEST, StartDir.NORTH_EAST];
const angleToNum = ["a", "q", "w", "e", "d", "s"];
class Pattern {
    startDir;
    angleSig;
    id;
    constructor(startDir, angleSig, id) {
        this.startDir = startDir;
        this.angleSig = angleSig;
        this.id = id;
    }
    get name() {
        let split = this.id.split("|");
        if (split[0] == "pattern") {
            return patternReg.patterns[split[1]].name;
        }
        return "hagdhj";
    }
}
let patternReg = {
    categories: {}, entries: {}, mods: {}, pages: {},
    patterns: {}, pregenerated_numbers: [], recipes: {}, special_handlers: {}
};
const synonyms = new Map([
    ["{", "hexcasting:open_paren"],
    ["}", "hexcasting:close_paren"]
]);
let regMap = new Map();
function cachePatternNames() {
    for (let key of Object.keys(patternReg.patterns)) {
        regMap.set(patternReg.patterns[key].name, patternReg.patterns[key]);
    }
    for (let [k, v] of synonyms.entries()) {
        regMap.set(k, patternReg.patterns[v]);
    }
}
function stupidfuckingbookkeepers(mask) {
    let split = mask.split("");
    let startDir = split[0] == "-" ? StartDir.EAST : StartDir.SOUTH_EAST;
    let sig = split[0] == "-" ? [] : ["a"];
    let curr = split[0];
    for (let ptr = 1; ptr < split.length; ptr++) {
        let prev = curr;
        curr = split[ptr];
        switch (prev + curr) {
            case "--":
                sig.push("w");
                break;
            case "-v":
                sig.push("ea");
                break;
            case "v-":
                sig.push("e");
                break;
            case "vv":
                sig.push("da");
                break;
        }
    }
    return new Pattern(startDir, sig.join(""), "special|hexcasting:mask");
}
function parsePatterns(text) {
    let lines = text.split("\n").map(x => x.trim());
    return lines.map(parsePattern);
}
function parsePattern(text) {
    if (regMap.has(text)) {
        let pat = regMap.get(text);
        return { text: text, pattern: new Pattern(pat.direction, pat.signature, `pattern|${pat.id}`) };
    }
    else if (text.startsWith("Numerical Reflection: ") && Math.abs(parseInt(text.slice(22))) <= 2000) {
        let pat = patternReg.pregenerated_numbers[parseInt(text.slice(22))];
        return { text: text, pattern: new Pattern(pat.direction, pat.signature, `special|hexcasting:number`) };
    }
    else if (text.startsWith("Bookkeeper's Gambit: ") && text.slice(21).split("").every(x => x == "v" || x == "-")) {
        let pat = stupidfuckingbookkeepers(text.slice(21));
        return { text: text, pattern: pat };
    }
    else {
        return { text: text };
    }
}
class Vec {
    x;
    y;
    static zero() { return new Vec(0, 0); }
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(that) { return new Vec(this.x + that.x, this.y + that.y); }
    sub(that) { return new Vec(this.x - that.x, this.y - that.y); }
    mul(that) { return new Vec(this.x * that, this.y * that); }
    div(that) { return new Vec(this.x / that, this.y / that); }
    get mag() { return (this.x ** 2 + this.y ** 2) ** 0.5; }
    unit() { return this.div(this.mag); }
    get xy() { return [this.x, this.y]; }
    static Tolerance = 0.001;
    tolerates(that) { return Math.abs(this.x - that.x) < Vec.Tolerance && Math.abs(this.y - that.y) < Vec.Tolerance; }
}
function coerce(facing) {
    if (facing < 0) {
        return coerce(facing + 6);
    }
    else if (facing > 5) {
        return coerce(facing - 6);
    }
    else {
        return facing;
    }
}
const stringify = (vec) => `${Math.round(vec.x * 1000) / 1000}|${Math.round(vec.y * 1000) / 1000}`;
function findTouchies(pattern) {
    const count = new Map();
    let facing = sdToNum.indexOf(pattern.startDir);
    let pos = Vec.zero();
    count.set(stringify(pos), 1);
    const delta = new Vec(Math.cos(facing * Math.PI / 3) * edgeLength, Math.sin(facing * Math.PI / 3) * edgeLength);
    pos = pos.add(delta);
    count.set(stringify(pos), 1);
    for (const angle of pattern.angleSig.split("")) {
        facing = coerce(facing + angleToNum.indexOf(angle) - 2);
        const delta = new Vec(Math.cos(facing * Math.PI / 3) * edgeLength, Math.sin(facing * Math.PI / 3) * edgeLength);
        pos = pos.add(delta);
        count.set(stringify(pos), (count.get(stringify(pos)) ?? 0) + 1);
    }
    return count;
}
class AABB {
    minx;
    miny;
    maxx;
    maxy;
    constructor(minx, miny, maxx, maxy) {
        this.minx = minx;
        this.miny = miny;
        this.maxx = maxx;
        this.maxy = maxy;
    }
    expand(pos) {
        if (pos.x < this.minx) {
            this.minx = pos.x;
        }
        if (pos.y < this.miny) {
            this.miny = pos.y;
        }
        if (pos.x > this.maxx) {
            this.maxx = pos.x;
        }
        if (pos.y > this.maxy) {
            this.maxy = pos.y;
        }
    }
    get width() { return this.maxx - this.minx; }
    get height() { return this.maxy - this.miny; }
    get center() { return new Vec((this.minx + this.maxx) / 2, (this.miny + this.maxy) / 2); }
}
function findPatternSize(pattern) {
    let aabb = new AABB(0, 0, 0, 0);
    let facing = sdToNum.indexOf(pattern.startDir);
    let pos = Vec.zero();
    const delta = new Vec(Math.cos(facing * Math.PI / 3) * edgeLength, Math.sin(facing * Math.PI / 3) * edgeLength);
    pos = pos.add(delta);
    aabb.expand(pos);
    for (const angle of pattern.angleSig.split("")) {
        facing = coerce(facing + angleToNum.indexOf(angle) - 2);
        const delta = new Vec(Math.cos(facing * Math.PI / 3) * edgeLength, Math.sin(facing * Math.PI / 3) * edgeLength);
        pos = pos.add(delta);
        aabb.expand(pos);
    }
    return aabb;
}
function drawPattern(canvas, pattern, centerPos, left = new Vec(1, 0), down = new Vec(0, 1)) {
    let ctx = canvas.getContext("2d");
    let aabb = findPatternSize(pattern);
    function transform(pos) {
        // debugger
        let A = pos.sub(aabb.center);
        let B = left.mul(A.x).add(down.mul(A.y));
        return centerPos.add(B);
    }
    // ctx.beginPath(); ctx.arc(...transform(aabb.center).xy, 3, 0, Math.PI*2); ctx.fill()
    const count = findTouchies(pattern);
    let facing = sdToNum.indexOf(pattern.startDir);
    let pos = new Vec(0, 0);
    ctx.beginPath();
    let forwards = new Vec(Math.cos(facing * Math.PI / 3), Math.sin(facing * Math.PI / 3));
    let pathLeft = new Vec(-forwards.y, forwards.x);
    const curveDist = curvePercent * edgeLength;
    ctx.moveTo(...transform(pos.add(forwards.mul(curveDist)).add(pathLeft.mul(markWidth / 2))).xy);
    ctx.lineTo(...transform(pos.add(forwards.mul(curveDist)).sub(pathLeft.mul(markWidth / 2))).xy);
    ctx.moveTo(...transform(pos.add(forwards.mul(curveDist))).xy);
    pos = pos.add(forwards.mul(edgeLength));
    ctx.lineTo(...transform(pos.sub(forwards.mul(curveDist))).xy);
    for (const angle of pattern.angleSig.split("")) {
        facing = coerce(facing + angleToNum.indexOf(angle) - 2);
        forwards = new Vec(Math.cos(facing * Math.PI / 3), Math.sin(facing * Math.PI / 3));
        pathLeft = new Vec(-forwards.y, forwards.x);
        ctx.quadraticCurveTo(...transform(pos).xy, ...transform(pos.add(forwards.mul(curveDist))).xy);
        if (angle == "w" && count.get(stringify(pos)) == 1) {
            ctx.moveTo(...transform(pos.add(pathLeft.mul(markWidth / 2))).xy);
            ctx.lineTo(...transform(pos.sub(pathLeft.mul(markWidth / 2))).xy);
            ctx.moveTo(...transform(pos.add(forwards.mul(curveDist))).xy);
        }
        pos = pos.add(forwards.mul(edgeLength));
        ctx.lineTo(...transform(pos.sub(forwards.mul(curveDist))).xy);
    }
    ctx.lineTo(...transform(pos.sub(forwards.mul(curveDist * 2).add(pathLeft.mul(markWidth / 2)))).xy);
    ctx.moveTo(...transform(pos.sub(forwards.mul(curveDist * 2).sub(pathLeft.mul(markWidth / 2)))).xy);
    ctx.lineTo(...transform(pos.sub(forwards.mul(curveDist))).xy);
    ctx.strokeStyle = strokeStyle;
    ctx.stroke();
}
function path(t) {
    return new Vec(350, 350).add(new Vec(Math.cos(t), -Math.sin(t)).mul(100 * t / (2 * Math.PI) * 0.45));
}
function dpdt(t) {
    let dt = 0.01;
    return path(t + dt).sub(path(t - dt)).div(dt).unit();
}
function d2pdt2(t) {
    let dt = 0.01;
    return dpdt(t + dt).sub(dpdt(t - dt)).div(dt).unit();
}
fetch("registry.json")
    .then(x => x.json())
    .then(x => {
    patternReg = x;
    cachePatternNames();
    let canvas = document.getElementById("canvas");
    canvas.width = 700;
    canvas.height = 700;
    // let iotas = parsePatterns("Mind's Reflection\nCompass' Purification\nMind's Reflection\nAlidade's Purification\nArcher's Distillation")
    fetch("fabrik.hexpattern")
        .then(x => x.text())
        .then(x => {
        let iotas = parsePatterns(x);
        let t = 3;
        let ctx = canvas.getContext("2d");
        for (let i = 0; i < iotas.length; i++) {
            let iota = iotas[iotas.length - i - 1];
            let pos = path(t);
            drawPattern(canvas, iota.pattern, pos, dpdt(t).mul(-1), d2pdt2(t));
            let aabb1 = findPatternSize(iota.pattern);
            // ctx.beginPath(); ctx.arc(...pos.xy, 3, 0, Math.PI*2); ctx.fill()
            if (iotas[iotas.length - i - 2] == undefined)
                break;
            let aabb2 = findPatternSize(iotas[iotas.length - i - 2].pattern);
            let gap = aabb1.width / 2 + aabb2.width / 2;
            while (path(t).sub(pos).mag < gap + 2.5) {
                t += 0.01;
            }
        }
    });
});
// ctx.moveTo(...path(0).xy)
// ctx.lineTo(...path(0).add(dpdt(0)).xy)
// ctx.moveTo(...path(0).xy)
// ctx.lineTo(...path(0).add(d2pdt2(0)).xy)
// ctx.moveTo(...path(0).xy)
// for (let t = 0.1; t<=10; t += 0.5) {
// 	let T = t/10*2*Math.PI
// 	ctx.lineTo(...path(T).xy)
// 	ctx.lineTo(...path(T).add(dpdt(T).mul(10)).xy)
// 	ctx.moveTo(...path(T).xy)
// 	ctx.lineTo(...path(T).add(d2pdt2(T).mul(10)).xy)
// 	ctx.moveTo(...path(T).xy)
// }
// ctx.lineTo(...path(0).xy)
// ctx.stroke()
//# sourceMappingURL=Main.js.map
const edgeLength = 16
const padding = 5
const strokeStyle = "black"
const curvePercent = 0.2
const markWidth = 5

// const canvas = document.getElementById("canvas")! as HTMLCanvasElement
// const ctx = canvas.getContext("2d")!
enum StartDir {
	EAST = "EAST",
	SOUTH_EAST = "SOUTH_EAST",
	SOUTH_WEST = "SOUTH_WEST",
	WEST = "WEST",
	NORTH_WEST = "NORTH_WEST",
	NORTH_EAST = "NORTH_EAST"
}
const sdToNum = [StartDir.EAST, StartDir.SOUTH_EAST, StartDir.SOUTH_WEST, StartDir.WEST, StartDir.NORTH_WEST, StartDir.NORTH_EAST]
const angleToNum = ["a", "q", "w", "e", "d", "s"]

interface Operator {
	book_url: string,
	description: string,
	inputs: string,
	outputs: string,
	mod_id: string
}

interface RegPattern {
	direction: StartDir,
	display_as: null,
	display_only: boolean,
	id: string,
	is_per_world: boolean,
	name: string,
	operators: Operator[],
	signature: string
}

interface IPatternReg {
	categories: { [id: string]: {}},
	entries: { [id: string]: {}},
	mods: { [modid: string]: {}},
	pages: { [id: string]: []},
	patterns: { [id: string]: RegPattern}
	pregenerated_numbers: {[n: number]: {
		direction: StartDir,
		signature: string
	}}
	recipes: { [id: string]: {}}
	special_handlers: { [id: string]: {
		base_name: string,
		id: string,
		operator: Operator
	}}
}

class Pattern {
	constructor(
		public startDir: StartDir,
		public angleSig: string,
		public id: string,
	) {}
	get name() {
		let split = this.id.split("|")
		if (split[0] == "pattern") {
			return patternReg.patterns[split[1]].name
		}
		return "hagdhj"
	}
}
interface Iota {
	text: string,
	pattern?: Pattern
}

let patternReg: IPatternReg = {
	categories: {}, entries: {}, mods: {}, pages: {},
	patterns: {}, pregenerated_numbers: [], recipes: {}, special_handlers: {} 
}
const synonyms = new Map<string, string>([
	["{", "hexcasting:open_paren"],
	["}", "hexcasting:close_paren"]
])

let regMap = new Map<string, RegPattern>()
function cachePatternNames() {
	for (let key of Object.keys(patternReg.patterns)) {
		regMap.set(patternReg.patterns[key].name, patternReg.patterns[key])
	}
	for (let [k, v] of synonyms.entries()) {
		regMap.set(k, patternReg.patterns[v])
	}
}

function stupidfuckingbookkeepers(mask: string) {
	let split = mask.split("")
	let startDir = split[0] == "-" ? StartDir.EAST : StartDir.SOUTH_EAST
	let sig = split[0] == "-" ? [] : ["a"]
	let curr = split[0]
	for (let ptr = 1; ptr < split.length; ptr++) {
		let prev = curr
		curr = split[ptr]
		switch (prev + curr) {
			case "--":
				sig.push("w")
				break
			case "-v":
				sig.push("ea")
				break
			case "v-":
				sig.push("e")
				break
			case "vv":
				sig.push("da")
				break
		}
	}
	return new Pattern(startDir, sig.join(""), "special|hexcasting:mask")
}

function parsePatterns(text: string): Iota[] {
	let lines = text.split("\n").map(x=>x.trim())
	return lines.map(parsePattern)
}

function parsePattern(text: string): Iota {
	if (regMap.has(text)) {
		let pat = regMap.get(text)!
		return {text: text, pattern: new Pattern(
			pat.direction,
			pat.signature,
			`pattern|${pat.id}`
		)}
	} else if (text.startsWith("Numerical Reflection: ") && Math.abs(parseInt(text.slice(22))) <= 2000) {
		let pat = patternReg.pregenerated_numbers[parseInt(text.slice(22))]
		return {text: text, pattern: new Pattern(
			pat.direction,
			pat.signature,
			`special|hexcasting:number`
		)}
	} else if (text.startsWith("Bookkeeper's Gambit: ") && text.slice(21).split("").every(x => x == "v" || x == "-")) {
		let pat = stupidfuckingbookkeepers(text.slice(21))
		return {text: text, pattern: pat}
	} else {
		return {text: text}
	}
}

class Vec {

	static zero() {return new Vec(0,0)}

	constructor(public x: number, public y: number) {}
	add(that: Vec) {return new Vec(this.x + that.x, this.y + that.y)}
	sub(that: Vec) {return new Vec(this.x - that.x, this.y - that.y)}
	mul(that: number) {return new Vec(this.x * that, this.y*that)}
	div(that: number) {return new Vec(this.x / that, this.y/that)}

	get mag() {return (this.x**2 + this.y**2)**0.5}
	unit() {return this.div(this.mag)}

	get xy(): [number, number] {return [this.x, this.y]}
	static Tolerance = 0.001

	tolerates(that: Vec) { return Math.abs(this.x-that.x) < Vec.Tolerance && Math.abs(this.y-that.y) < Vec.Tolerance}

}
function coerce(facing: number) {
	if (facing < 0) {return coerce(facing + 6)}
	else if (facing > 5) {return coerce(facing - 6)}
	else {return facing}
}

const stringify = (vec: Vec) =>  `${Math.round(vec.x*1000)/1000}|${Math.round(vec.y*1000)/1000}`

function findTouchies(pattern: Pattern) {
	const count = new Map<string, number>()
	
	let facing = sdToNum.indexOf(pattern.startDir)
	let pos = Vec.zero()
	count.set(stringify(pos), 1)
	const delta = new Vec(
		Math.cos(facing * Math.PI/3)*edgeLength, 
		Math.sin(facing * Math.PI/3)*edgeLength
	)
	pos = pos.add(delta)
	count.set(stringify(pos), 1)
	
	for (const angle of pattern.angleSig.split("")) {
		facing = coerce(facing + angleToNum.indexOf(angle)-2)
		const delta = new Vec(
			Math.cos(facing * Math.PI/3)*edgeLength, 
			Math.sin(facing * Math.PI/3)*edgeLength
		)
		pos = pos.add(delta)
		count.set(stringify(pos), (count.get(stringify(pos)) ?? 0) + 1)
	}

	return count
}

class AABB {
	constructor (
		public minx: number,
		public miny: number,
		public maxx: number,
		public maxy: number,
	) {}
	expand(pos: Vec) {
		if (pos.x < this.minx) { this.minx = pos.x }
		if (pos.y < this.miny) { this.miny = pos.y }
		if (pos.x > this.maxx) { this.maxx = pos.x }
		if (pos.y > this.maxy) { this.maxy = pos.y }
	}
	get width() {return this.maxx - this.minx}
	get height() {return this.maxy - this.miny}
	get center() {return new Vec((this.minx+this.maxx)/2, (this.miny+this.maxy)/2)}
}

function findPatternSize(pattern: Pattern) {
	let aabb = new AABB(0,0,0,0)

	let facing = sdToNum.indexOf(pattern.startDir)
	let pos = Vec.zero()
	const delta = new Vec(
		Math.cos(facing * Math.PI/3)*edgeLength, 
		Math.sin(facing * Math.PI/3)*edgeLength
	)
	pos = pos.add(delta)

	aabb.expand(pos)
	for (const angle of pattern.angleSig.split("")) {
		facing = coerce(facing + angleToNum.indexOf(angle)-2)
		const delta = new Vec(
			Math.cos(facing * Math.PI/3)*edgeLength, 
			Math.sin(facing * Math.PI/3)*edgeLength
		)
		pos = pos.add(delta)
		aabb.expand(pos)
	}

	return aabb
}

function drawPattern(canvas: HTMLCanvasElement, pattern: Pattern, centerPos: Vec, left: Vec = new Vec(1,0), down: Vec = new Vec(0,1)) {
	let ctx = canvas.getContext("2d")!
	let aabb = findPatternSize(pattern)
	function transform(pos: Vec): Vec {
		// debugger
		let A = pos.sub(aabb.center)
		let B = left.mul(A.x).add(down.mul(A.y))
		return centerPos.add(B)
	}
	// ctx.beginPath(); ctx.arc(...transform(aabb.center).xy, 3, 0, Math.PI*2); ctx.fill()

	const count = findTouchies(pattern)

	let facing = sdToNum.indexOf(pattern.startDir)
	let pos = new Vec(0, 0)
	ctx.beginPath()
	let forwards = new Vec(
		Math.cos(facing * Math.PI/3), 
		Math.sin(facing * Math.PI/3)
	)
	let pathLeft = new Vec(-forwards.y, forwards.x)
	const curveDist = curvePercent * edgeLength 

	ctx.moveTo(...transform(pos.add(forwards.mul(curveDist)).add(pathLeft.mul(markWidth/2))).xy)
	ctx.lineTo(...transform(pos.add(forwards.mul(curveDist)).sub(pathLeft.mul(markWidth/2))).xy)

	ctx.moveTo(...transform(pos.add(forwards.mul(curveDist))).xy)
	pos = pos.add(forwards.mul(edgeLength))
	ctx.lineTo(...transform(pos.sub(forwards.mul(curveDist))).xy)

	for (const angle of pattern.angleSig.split("")) {
		facing = coerce(facing + angleToNum.indexOf(angle)-2)
		forwards = new Vec(
			Math.cos(facing * Math.PI/3), 
			Math.sin(facing * Math.PI/3)
		)
		pathLeft = new Vec(-forwards.y, forwards.x)
		ctx.quadraticCurveTo(...transform(pos).xy, ...transform(pos.add(forwards.mul(curveDist))).xy)

		if (angle == "w" && count.get(stringify(pos)) == 1 ) {
			ctx.moveTo(...transform(pos.add(pathLeft.mul(markWidth/2))).xy)
			ctx.lineTo(...transform(pos.sub(pathLeft.mul(markWidth/2))).xy)
			ctx.moveTo(...transform(pos.add(forwards.mul(curveDist))).xy)
		}

		pos = pos.add(forwards.mul(edgeLength))
		ctx.lineTo(...transform(pos.sub(forwards.mul(curveDist))).xy)
	}

	ctx.lineTo(...transform(pos.sub(forwards.mul(curveDist*2).add(pathLeft.mul(markWidth/2)))).xy)
	ctx.moveTo(...transform(pos.sub(forwards.mul(curveDist*2).sub(pathLeft.mul(markWidth/2)))).xy)
	ctx.lineTo(...transform(pos.sub(forwards.mul(curveDist))).xy)

	ctx.strokeStyle = strokeStyle
	ctx.stroke()
	
}

function path(t: number): Vec {
	return new Vec(350, 350).add(new Vec(Math.cos(t), -Math.sin(t)).mul(100 * t/(2*Math.PI) * 0.45))
}
function dpdt(t: number): Vec {
	let dt = 0.01
	return path(t+dt).sub(path(t-dt)).div(dt).unit()
}
function d2pdt2(t: number): Vec {
	let dt = 0.01
	return dpdt(t+dt).sub(dpdt(t-dt)).div(dt).unit()
}


fetch("registry.json")
.then(x => x.json())
.then(x => {
	patternReg = x as IPatternReg
	cachePatternNames()
	let canvas = document.getElementById("canvas")! as HTMLCanvasElement
	canvas.width = 700
	canvas.height = 700
	// let iotas = parsePatterns("Mind's Reflection\nCompass' Purification\nMind's Reflection\nAlidade's Purification\nArcher's Distillation")

	fetch("fabrik.hexpattern")
	.then(x => x.text())
	.then(x => {
		let iotas = parsePatterns(x)
		let t = 3
		let ctx = canvas.getContext("2d")!
		for (let i=0; i<iotas.length; i++) {
			let iota = iotas[iotas.length - i - 1]
			let pos = path(t)
			drawPattern(canvas, iota.pattern!, pos, dpdt(t).mul(-1), d2pdt2(t))
			let aabb1 = findPatternSize(iota.pattern!)
			// ctx.beginPath(); ctx.arc(...pos.xy, 3, 0, Math.PI*2); ctx.fill()
			if (iotas[iotas.length - i -2] == undefined) break;
			let aabb2 = findPatternSize(iotas[iotas.length - i -2].pattern!)
			let gap = aabb1.width/2 + aabb2.width/2
			while (path(t).sub(pos).mag < gap+2.5) {t += 0.01}
		}
	})
})

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
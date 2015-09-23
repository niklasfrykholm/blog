# Allocation Interlude: JavaScript Animation

Making technical illustrations in drawing programs is tedious and boring. We are programmers, we should be *programming* our illustrations. Luckily, with JavaScript and its canvas, we can. And we can make them move!

To try this out, and to brush up my rusty JavaScript so that I can hang with all the cool web kids, I made an illustration of the how the buddy allocator described in the last article works:

<script>
var Buddy = {
	data: {
		console: [],
		allocations: [],
		levels: 5,
		size: 128,
		blockState: [],
		freeLists: [],
	},
	layout: {
		console: {
			font: "18px sans-serif",
			x: 40,
			y: 300,
			lineHeight: 20,
			maxLines: 10,
		},
		allocations: {
			x: 300,
			y: 300,
			headerFont: "18px sans-serif",
			headerLineHeight: 30,
			font: "14px sans-serif",
			rowHeight: 20,
			columns: 8,
			columnWidth: 30,
		},
		tree: {
			font: "14px sans-serif",
			x: 100,
			y: 40,
			width: 512,
			height: 200,
			stateFill: {
				"split" : "#dd9",
				"allocated" : "#c99",
				"free" : "#9c9",
			},
		},
		legend: {
			font: "18px sans-serif",
			x: 550,
			y: 300,
			texts: ["Split", "Allocated", "Free"],
			colors: ["#dd9", "#c99", "#9c9"],
		},
		animationStepMs: 500,
	},

	new: function() {
		var o = Object.create(this);
		o.data = JSON.parse(JSON.stringify(this.data));
		o.layout = JSON.parse(JSON.stringify(this.layout));
		return o;
	},
	numBlocks: function() {
		return (1<<this.data.levels)-1;
	},
	sizeOfLevel: function(level) {
		return this.data.size / (1 << level);
	},
	levelOfSize: function (size) {
		return Math.log2(this.data.size / size);
	},
	levelOfBlock: function (block) {
		return Math.floor(Math.log2(block+1));
	},
	draw: function (ctx) {
		var data = this.data;
		var layout = this.layout;

		this.drawConsole(ctx, data.console, layout.console);
		this.drawAllocations(ctx, data.allocations, layout.allocations);
		this.drawTree(ctx, data, layout.tree);
		this.drawLegend(ctx, layout.legend);
	},
	drawConsole: function(ctx, data, layout) {
		ctx.font = layout.font;
		var y = layout.y;
		for (var i=0; i<data.length; ++i) {
			if (data[i].startsWith(">"))
				ctx.fillStyle = "#000";
			else
				ctx.fillStyle = "#999";
			ctx.fillText(data[i], layout.x, y);
			y = y + layout.lineHeight;
		}
		ctx.fillStyle = "#000";
	},
	drawAllocations: function(ctx, data, layout) {
		var x = layout.x;
		var y = layout.y;
		ctx.font = layout.headerFont;
		ctx.fillText("Allocations", x,y);
		y = y + layout.headerLineHeight;
		ctx.font = layout.font;
		var col = 0;
		var baseX = x;
		for (var i=0; i<data.length; ++i) {
			ctx.fillText(data[i], x, y);
			x = x + layout.columnWidth;
			col++;
			if (col == layout.columns) {
				y += layout.rowHeight;
				x = baseX;
				col = 0;
			}
		}
	},
	drawTree: function(ctx, data, layout) {
		ctx.font = layout.font;
		ctx.fillStyle = "#f00";
		ctx.fillText("freelist", layout.x-40, layout.y-10);
		ctx.fillStyle = "#000";
		var h = layout.height / data.levels;
		for (var i=0; i<data.levels; ++i) {
			var blocks = (1<<i);
			var w = layout.width / blocks;
			ctx.fillText("level " + i, layout.x-80, layout.y+i*h+25);
			var s = this.sizeOfLevel(i);
			ctx.textAlign = "right";
			ctx.fillText(s + " K", layout.x+layout.width+50, layout.y+i*h+25);
			ctx.textAlign = "left";
			for (var j=0; j<blocks; ++j) {
				var block_index = (1<<i) + j - 1;
				var state = data.blockState[block_index];
				if (layout.stateFill[state]) {
					ctx.fillStyle = layout.stateFill[state];
					ctx.fillRect(layout.x+j*w,layout.y+i*h,w,h);
					ctx.fillStyle = "#000";
				}
				ctx.strokeRect(layout.x+j*w,layout.y+i*h,w,h);
			}

			ctx.strokeStyle = "#f00";
			ctx.strokeRect(layout.x-30,layout.y+i*h,20,h);
			var freeList = data.freeLists[i] || [];
			ctx.beginPath();
			var x0 = layout.x-20;
			var y0 = layout.y+i*h+21
			ctx.moveTo(x0,y0);
			for (var j=0; j<freeList.length; ++j) {
				var index_in_level = freeList[j] - ((1<<i)-1);
				var x1 = layout.x + w*index_in_level + w/2
				var y1 = layout.y+i*h + h/2
				var yc = y1 - Math.abs(x0-x1)/4
				ctx.bezierCurveTo(x0, yc, x1, yc, x1, y1);
				x0 = x1;
				y0 = y1;
			}
			ctx.stroke();
			ctx.strokeStyle = "#000";
		}
	},
	drawLegend: function(ctx, layout) {
		ctx.font = layout.font;
		for (var i=0; i<layout.texts.length; ++i) {
			var text = layout.texts[i];
			ctx.fillStyle = layout.colors[i];
			ctx.fillRect(layout.x,layout.y+i*30-15,20,20);
			ctx.strokeRect(layout.x,layout.y+i*30-15,20,20);
			ctx.fillStyle = "#000";
			ctx.fillText(text, layout.x+30, layout.y + i*30);
		}
	},
	log: function*(s) {
		var data = this.data.console;
		var layout = this.layout.console;
		data.push(s);
		while (data.length > layout.maxLines)
			data.shift();
		yield;
	},
	init: function*() {
		var data = this.data;
		for (var i=0; i<data.levels; ++i)
			data.freeLists[i] = [];
		yield* this.log("> init");
		data.blockState[0] = "free";
		yield;
		data.freeLists[0] = [0];
		yield;
		yield* this.log("ok");
	},
	split: function*(level) {
		if (level < 0)
			return;
		var data = this.data;
		if (data.freeLists[level].length == 0)
			yield* this.split(level-1);
		if (data.freeLists[level].length == 0)
			return;
		var block = data.freeLists[level].shift();
		yield;
		data.blockState[block] = 'split';
		yield;
		var b1 = block*2+1;
		var b2 = block*2+2;
		data.blockState[b1] = 'free';
		data.blockState[b2] = 'free';
		yield;
		data.freeLists[level+1].push(b1);
		data.freeLists[level+1].push(b2);
		yield;
	},
	allocate: function*(size) {
		yield* this.log("> allocate(" + size + " K)");
		var data = this.data;
		var level = this.levelOfSize(size);
		if (data.freeLists[level].length == 0 && level>0)
			yield* this.split(level-1);
		if (data.freeLists[level].length == 0) {
			yield* this.log("# OUT OF MEMORY");
			return null;
		}

		var p = data.freeLists[level].shift();
		yield;
		data.blockState[p] = 'allocated';
		yield;
		yield* this.log("= " + p);
		data.allocations.push(p);
		yield;
		return p;
	},
	merge: function*(p) {
		var level = this.levelOfBlock(p);
		if (level == 0)
			return;

		var data = this.data;
		var buddy = (p % 2) ? (p + 1) : (p - 1);
		if (data.blockState[buddy] != 'free')
			return;
		data.blockState[p] = null;
		data.blockState[buddy] = null;
		yield;
		data.freeLists[level].splice(data.freeLists[level].indexOf(p), 1);
		data.freeLists[level].splice(data.freeLists[level].indexOf(buddy), 1);
		yield;
		var parent = Math.floor((p-1)/2);
		data.blockState[parent] = 'free';
		yield;
		data.freeLists[level-1].push(parent);
		yield;
		yield* this.merge(parent);
	},
	free: function*(p) {
		var data = this.data;
		yield* this.log("> free(" + p + ")");
		var level = this.levelOfBlock(p);
		data.blockState[p] = 'free';
		yield;
		data.freeLists[level].push(p);
		yield;
		yield *this.merge(p);
		yield* this.log("ok");
		var allocations = data.allocations;
		var idx = allocations.indexOf(p);
		allocations.splice(idx, 1);
	},
};

function* animate(buddy)
{
	while (true) {
		yield* buddy.init();
		var allocations = buddy.data.allocations;

		for (var i=0; i<100; ++i) {
			if (Math.random() < 0.6 || allocations.length == 0) {
				var data = buddy.data;
				var block = Math.floor(Math.random() * buddy.numBlocks());
				var level = buddy.levelOfBlock(Math.floor(block));
				var p = yield* buddy.allocate(buddy.sizeOfLevel(level));
			} else {
				var idx = Math.floor(Math.random() * allocations.length);
				yield* buddy.free(allocations[idx]);
			}
		}

		var empty = Buddy.new();
		buddy.data = empty.data;
	}
}

function update(canvas, buddy, mutator)
{
	mutator.next();

	var context = canvas.getContext("2d");
	context.save();
	context.clearRect(0,0,canvas.width, canvas.height);

	buddy.draw(context)

	context.restore()

	window.setTimeout( function() {update(canvas, buddy, mutator);}, buddy.layout.animationStepMs );
}

function test(canvas)
{
	var buddy = Buddy.new();
	update(canvas, buddy, animate(buddy));
}
</script>

<p><canvas id="canvas" width="900" height="500"/></p>

<script>test(document.getElementById("canvas"));</script>

Note, I use ECMAScript 2015, so this code currently only works in recent versions of Chrome and Firefox. Sorry, but worrying about compatibility takes all the fun out of JavaScript. 
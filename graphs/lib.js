var Rect = class
{
    constructor(opt) {
        if (opt.w || opt.width) {this.w = opt.w || opt.width;}
        else if (opt.left && opt.right) {this.w = opt.right - opt.left;}
        else {opt.w = 0.0;}

        if (opt.x || opt.left) {this.x = opt.x || opt.left;}
        else if (opt.center) {this.x = opt.center - this.w/2;}
        else if (opt.right) {this.x = opt.right - this.w;}
        else {opt.x = 0.0;}

        if (opt.h || opt.height) {this.h = opt.h || opt.height;}
        else if (opt.top && opt.bottom) {this.h = opt.bottom - opt.top;}
        else {opt.h = 0.0;}

        if (opt.y || opt.top) {this.y = opt.y || opt.top;}
        else if (opt.middle) {this.y = opt.middle - this.h/2;}
        else if (opt.bottom) {this.y = opt.bottom - this.h;}
        else {opt.y = 0.0;}
    }

    get left() {return this.x;}
    get center() {return this.x + this.w/2;}
    get right() {return this.x + this.w;}

    get top() {return this.y;}
    get middle() {return this.y + this.h/2;}
    get bottom() {return this.y + this.h;}

    get topLeft()   {return new Rect({x: this.left,   y: this.top});}
    get topCenter() {return new Rect({x: this.center, y: this.top});}
    get topRight()  {return new Rect({x: this.right,  y: this.top});}

    get middleLeft()   {return new Rect({x: this.left,   y: this.middle});}
    get middleCenter() {return new Rect({x: this.center, y: this.middle});}
    get middleRight()  {return new Rect({x: this.right,  y: this.middle});}

    get bottomLeft()   {return new Rect({x: this.left,   y: this.bottom});}
    get bottomCenter() {return new Rect({x: this.center, y: this.bottom});}
    get bottomRight()  {return new Rect({x: this.right,  y: this.bottom});}

    offset(x,y) {return new Rect({x: this.x+x, y: this.y+y, w: this.w, h: this.h});}
    outset(s)   {return new Rect({x: this.x-s, y: this.y-s, w: this.w+2*s, h: this.h+2*s});}

    static union() {
        var left,right,top,bottom;
        for (var i=0; i<arguments.length; ++i) {
            var r = arguments[i];
            left = Math.min(left || r.left, r.left);
            right = Math.max(right || r.right, r.right);
            top = Math.min(top || r.top, r.top);
            bottom = Math.max(bottom || r.bottom, r.bottom);
        }
        return new Rect({left:left, top:top, right:right, bottom:bottom});
    }
};

var draw = {
  textbox: function(ctx, text, r) {
    ctx.save();
    ctx.fillStyle = "#eee";
    ctx.fillRect(r.x,r.y,r.w,r.h);
    ctx.fillStyle = "#000";
    ctx.strokeRect(r.x,r.y,r.w,r.h);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, r.center, r.middle);
    ctx.restore();
  },
  arrow: function(ctx, p1, p2, doubleArrow) {
    ctx.save();

    var w = 10;
    var h = 20;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);

    var len = Math.sqrt((p2.x-p1.x)*(p2.x-p1.x) + (p2.y-p1.y)*(p2.y-p1.y));
    var dx = (p2.x-p1.x)/len;
    var dy = (p2.y-p1.y)/len;
    ctx.lineTo(p2.x - dx*h - dy*w, p2.y - dy*h + dx*w);
    ctx.moveTo(p2.x, p2.y);
    ctx.lineTo(p2.x - dx*h + dy*w, p2.y - dy*h - dx*w);

    if (doubleArrow) {
      ctx.moveTo(p1.x,p1.y);
      ctx.lineTo(p1.x + dx*h - dy*w, p1.y + dy*h + dx*w);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p1.x + dx*h + dy*w, p1.y + dy*h - dx*w);
    }

    ctx.stroke();
    ctx.restore();

    return new Rect({left: p1.x, top: p1.y, right: p2.x, bottom: p2.y});
  }
};

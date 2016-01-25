class Point
{
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Rect
{
    constructor(x,y,w,h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    get left() {return this.x;}
    get center() {return this.x + this.w/2;}
    get right() {return this.x + this.w;}

    get top() {return this.y;}
    get middle() {return this.y + this.h/2;}
    get bottom() {return this.y + this.h;}

    get bottomCenter() {return new Point(this.center, this.bottom);}
    get topCenter() {return new Point(this.center, this.top);}

    offset(x,y) {return new Rect(this.x+x, this.y+y, this.w, this.h);}
}

var draw = {
  textbox: function(ctx, text, r) {
    ctx.fillStyle = "#eee";
    ctx.fillRect(r.x,r.y,r.w,r.h);
    ctx.fillStyle = "#000";
    ctx.strokeRect(r.x,r.y,r.w,r.h);
    ctx.font = "18px Arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, r.center, r.middle);
  },
  arrow: function(ctx, p1, p2, doubleArrow) {
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

    return new Rect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
  }
};

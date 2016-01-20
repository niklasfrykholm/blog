var draw = {
  textbox: function(ctx, text, x, y, w, h) {
    x = x || 0;
    y = y || 0;
    w = w || 200;
    h = h || 50;
    ctx.fillStyle = "#eee";
    ctx.fillRect(x,y,w,h);
    ctx.fillStyle = "#000";
    ctx.strokeRect(x,y,w,h);
    ctx.font = "18px Arial";
    var tm = ctx.measureText(text);

    ctx.fillText(text, x+w/2-tm.width/2, y+h/2+18/2);

    return {
      x: x, y: y, w: w, h: h,
      left: x, right: x+w, center: x+w/2,
      top: y, bottom: y+h, middle: y+h/2,
    };
  },
  arrow: function(ctx, x1, y1, x2, y2, doubleArrow) {
    var w = 10;
    var h = 20;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    var len = Math.sqrt((x2-x1)*(x2-x1) + (y2-y1)*(y2-y1));
    var dx = (x2-x1)/len;
    var dy = (y2-y1)/len;
    ctx.lineTo(x2 - dx*h - dy*w, y2 - dy*h + dx*w);
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - dx*h + dy*w, y2 - dy*h - dx*w);

    if (doubleArrow) {
      ctx.moveTo(x1,y1);
      ctx.lineTo(x1 + dx*h - dy*w, y1 + dy*h + dx*w);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + dx*h + dy*w, y1 + dy*h - dx*w);
    }

    ctx.stroke();
  }
};

reloadScript("lib.js");

function drawFrame(opt)
{
    var ctx = opt.ctx;
    ctx.save();
    var r = opt.r;
    r = r.outset(25);
    r.y -= 25;
    r.h += 25;
    ctx.fillStyle = opt.color || "#ff9";
    ctx.strokeStyle = "#333";
    ctx.setLineDash([5,5]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#000";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(opt.text || "Frame", r.left+10, r.top+10);
    ctx.restore();
}

function clear(ctx)
{
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0,0,10000,10000);
    ctx.restore();
}

function drawPipeline(ctx)
{
    clear(ctx);

    var disk = new Rect({x: 50, y: 80, w: 200, h:50})
    var trans = disk.offset(0, 200);
    var user = trans.offset(0, 150);
    var compiled = disk.offset(350, 0);
    var loaded = compiled.offset(0, 200);
    var instance = loaded.offset(0, 150);

    ctx.font = "bold 14px Arial";
    drawFrame({ctx: ctx, r:Rect.union(trans,user), text: "EDITOR", color: "#fcf"});
    drawFrame({ctx: ctx, r:Rect.union(disk,compiled), text: "DISK", color: "#cff"});
    drawFrame({ctx: ctx, r:Rect.union(loaded,instance), text: "RUNTIME", color: "#ffc"});

    ctx.font = "18px Arial";
    draw.textbox(ctx, "Resource (disk)", disk);
    draw.textbox(ctx, "Resource (transient)", trans);
    draw.textbox(ctx, "User", user);
    draw.textbox(ctx, "Resource (compiled)", compiled);
    draw.textbox(ctx, "Resource (loaded)", loaded);
    draw.textbox(ctx, "Instance", instance);

    var modify = draw.arrow(ctx, user.topCenter, trans.bottomCenter);
    ctx.fillText("Modify", modify.center + 20, modify.middle);
    var save = draw.arrow(ctx, trans.topCenter, disk.bottomCenter);
    ctx.fillText("Save", save.center + 20, save.middle);
    var compile = draw.arrow(ctx, disk.middleRight, compiled.middleLeft);
    ctx.textAlign = "center";
    ctx.fillText("Compile", compile.center, compile.middle - 20);
    var load = draw.arrow(ctx, compiled.bottomCenter, loaded.topCenter);
    ctx.textAlign = "left";
    ctx.fillText("Load", load.center + 20, load.middle);
    var spawn = draw.arrow(ctx, loaded.bottomCenter, instance.topCenter);
    ctx.fillText("Spawn", spawn.center + 20, spawn.middle);
}

function drawReload(ctx)
{
    clear(ctx);

    var disk = new Rect({x: 50, y: 80, w: 200, h:50})
    var trans = disk.offset(0, 200);
    var user = trans.offset(0, 150);
    var compiled = disk.offset(350, 0);
    var loaded = compiled.offset(0, 200);
    var instance = loaded.offset(0, 150);

    ctx.font = "bold 14px Arial";
    drawFrame({ctx: ctx, r:Rect.union(trans,user), text: "EDITOR", color: "#fcf"});
    drawFrame({ctx: ctx, r:Rect.union(disk,compiled), text: "DISK", color: "#cff"});
    drawFrame({ctx: ctx, r:Rect.union(loaded,instance), text: "RUNTIME", color: "#ffc"});

    ctx.font = "18px Arial";
    draw.textbox(ctx, "Resource (disk)", disk);
    draw.textbox(ctx, "Resource (transient)", trans);
    draw.textbox(ctx, "User", user);
    draw.textbox(ctx, "Resource (compiled)", compiled);
    draw.textbox(ctx, "Resource (loaded)", loaded);
    draw.textbox(ctx, "Instance", instance);

    var modify = draw.arrow(ctx, user.topCenter, trans.bottomCenter);
    ctx.fillText("Modify", modify.center + 20, modify.middle);
    var save = draw.arrow(ctx, trans.topCenter, disk.bottomCenter);
    ctx.fillText("Save", save.center + 20, save.middle);
    var compile = draw.arrow(ctx, disk.middleRight, compiled.middleLeft);
    ctx.textAlign = "center";
    ctx.fillText("Compile", compile.center, compile.middle - 20);
    var load = draw.arrow(ctx, compiled.bottomCenter, loaded.topCenter);
    ctx.textAlign = "left";
    ctx.fillText("Reload", load.center + 20, load.middle);
    var spawn = draw.arrow(ctx, loaded.bottomCenter.offset(10,0), instance.topCenter.offset(10,0));
    var spawn = draw.arrow(ctx, instance.topCenter.offset(-10,0), loaded.bottomCenter.offset(-10,0));
    ctx.fillText("Refresh", spawn.center + 30, spawn.middle);
}

function render()
{
    var body = document.getElementsByTagName("body")[0];
    while (body.hasChildNodes()) {
        body.removeChild(body.lastChild);
    }

    body.style.backgroundColor = "#ccc";

    {
        var canvas = document.createElement("canvas");
        canvas.width = 650;
        canvas.height = 530;
        var ctx = canvas.getContext("2d");
        drawPipeline(ctx);
        body.appendChild(canvas);
    }

    body.appendChild(document.createElement("p"));

    {
        var canvas = document.createElement("canvas");
        canvas.width = 650;
        canvas.height = 530;
        var ctx = canvas.getContext("2d");
        drawReload(ctx);
        body.appendChild(canvas);
    }
}

function reloadScript(s)
{
    var script = document.createElement("script");
    script.src = s + "?" + performance.now();
    script.type = "text/javascript";
    var head = document.getElementsByTagName("head")[0];
    head.appendChild(script);
    head.removeChild(script);
}

function reload()
{
    reloadScript("pipeline.js");
    render();
}

window.onload = render;

if (!window.has_reloader)
{
    window.has_reloader = true;
    window.setInterval(reload, 500);
}

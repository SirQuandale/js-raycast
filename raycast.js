// -- 2D VECTOR ---------------------------------------------------------------

var Vector2d = function(x, y) {
    this.x = x;
    this.y = y;
};

Vector2d.prototype.rotateBy = function(ang) {
    var c = Math.cos(ang),
        s = Math.sin(ang),
        x = this.x * c - this.y * s;
        y = this.x * s + this.y * c;
    return new Vector2d(x, y);
};

Vector2d.prototype.mult = function(k) {
    return new Vector2d(this.x * k, this.y * k);
};

// -- 2D MATRIX ---------------------------------------------------------------

var Matrix2d = function(a, b, c, d) {
    this.a = a; this.b = b;
    this.c = c; this.d = d;
};

Matrix2d.prototype.determinant = function() {
    return this.a * this.d - this.b * this.c;
};

Matrix2d.prototype.invert = function() {
    var det = this.determinant();
    if (det == 0)
        return undefined;

    return new Matrix2d( this.d / det, -this.b / det,
                        -this.c / det,  this.a / det);
};

Matrix2d.prototype.leftMultVector = function(vec) {
    return new Vector2d(this.a * vec.x + this.b * vec.y,
                        this.c * vec.x + this.d * vec.y);
};

// -- LINE --------------------------------------------------------------------

var Line = function(start, dir) {
    this.start = start;
    this.dir   = dir;
};

Line.prototype.eval = function(t) {
    return new Vector2d(this.start.x + this.dir.x * t,
                        this.start.y + this.dir.y * t);
};

Line.prototype.intersect = function(other) {
    var A = new Matrix2d(this.dir.x, -other.dir.x,
                         this.dir.y, -other.dir.y),
        b = new Vector2d(other.start.x - this.start.x,
                         other.start.y - this.start.y),
        inv, ts;

    inv = A.invert();
    if (!inv)
        return [-1, -1];

    ts = inv.leftMultVector(b);
    return [ts.x, ts.y];
};

// -- COLOR -------------------------------------------------------------------

var Color = function(r, g, b) {
    this.r = Math.max(0, Math.min(r, 1));
    this.g = Math.max(0, Math.min(g, 1));
    this.b = Math.max(0, Math.min(b, 1));

    this.canvasColor = 'rgb(' +
        Math.round(r * 255) + ',' +
        Math.round(g * 255) + ',' +
        Math.round(b * 255) + ')';
};

Color.prototype.intensify = function(multiplier) {
    return new Color(
        this.r * multiplier,
        this.g * multiplier,
        this.b * multiplier);
};

Color.ERROR = new Color(1, 0, 1);

// -- DATA --------------------------------------------------------------------

var rawMap = {
    walls: [
        { start: [0.0, 0.5], end: [0.2, 0.5], texture: 'brick.jpg' },
        { start: [0.2, 0.5], end: [0.2, 0.3], texture: 'brick.jpg' },
        { start: [0.2, 0.3], end: [0.8, 0.3], texture: 'orange-damascus.png' },
        { start: [0.8, 0.3], end: [0.8, 0.5], color: [1, 0, 0] },
        { start: [0.8, 0.5], end: [1.0, 0.5], color: [0, 0, 1] }
    ]
};

var map = { walls: [] };

var player = {
    pos: new Vector2d(0.5,  1.0),
    dir: new Vector2d(0.0, -1.0),
    fov: Math.PI / 2
};

// -- MAIN FUNCTIONALITY ------------------------------------------------------

var loadTexture = function() {
    var textures = {};
    return function(src, callback) {
        src = 'textures/' + src;
        if (textures[src])
            callback(textures[src]);

        var canv = document.createElement('canvas');
        var ctx  = canv.getContext('2d');
        textures[src] = canv;

        var img = new Image;
        img.onload = function() {
            canv.width  = this.width;
            canv.height = this.height;
            ctx.clearRect(0, 0, this.width, this.height);
            ctx.drawImage(this, 0, 0);
            callback(canv);
        };
        img.src = src;
    };
}();

var processRawMap = function() {
    var wall, start, end, color;

    map = { walls: [] };
    rawMap.walls.forEach(function(rawWall) {
        start = new Vector2d(rawWall.start[0], rawWall.start[1]);
        dir   = new Vector2d(
            rawWall.end[0] - start.x, rawWall.end[1] - start.y);

        color = rawWall.color ?
            new Color(rawWall.color[0], rawWall.color[1], rawWall.color[2]) :
            Color.ERROR;

        wall = {line: new Line(start, dir), color: color};
        map.walls.push(wall);

        if (rawWall.texture)
            loadTexture(rawWall.texture,
                function(wall) {
                    return function(tex) { wall.texture = tex; redraw(); }
                }(wall));
    });
};

var attachEvents = function() {
    document.addEventListener('keydown', function(evt) {
        var keyCode = evt.keyCode || evt.which,
        arrow = {left: 37, up: 38, right: 39, down: 40 };

        switch (keyCode) {
        case arrow.left:
            player.dir = player.dir.rotateBy(-0.087);
            redraw();
            break;
        case arrow.right:
            player.dir = player.dir.rotateBy( 0.087);
            redraw();
            break;
        case arrow.up:
            if (attemptMove( 0.025))
                redraw();
            break;
        case arrow.down:
            if (attemptMove(-0.025))
                redraw();
            break;
        }
    });
};

var attemptMove = function(dist) {
    var ray = new Line(player.pos, player.dir.mult(dist)),
        ts;

    for (var i = 0; i < map.walls.length; i++) {
        ts = ray.intersect(map.walls[i].line);

        if (ts[0] < 0 || ts[0] > 1)
            continue;
        if (ts[1] < 0 || ts[1] > 1)
            continue;

        return false;
    }

    player.pos = ray.eval(1);
    return true;
};

var redraw = function() {
    var viewport = document.getElementById('viewport');
    var hits = castRays(viewport.width);
    drawColumns(viewport, hits);
};

document.addEventListener('DOMContentLoaded', function() {
    processRawMap();
    attachEvents();
    redraw();
});

var castRays = function(nrays) {
    var dAng = player.fov / nrays,
        ang, dir, ray,
        hits = [];

    for (var i = 0; i < nrays; i++) {
        ang = -player.fov / 2 + dAng * i + dAng / 2;
        dir = player.dir.rotateBy(ang);
        ray = new Line(player.pos, dir);

        hits.push(castOneRay(ray));
    }
    return hits;
};

var castOneRay = function(ray) {
    var ts,
        minT = Infinity, closestWall = undefined, wallT = Infinity;

    map.walls.forEach(function(wall) {
        ts = ray.intersect(wall.line);

        if (ts[0] < 0)
            return;
        if (ts[1] < 0 || ts[1] > 1)
            return;

        if (ts[0] < minT) {
            minT = ts[0];
            closestWall = wall;
            wallT = ts[1];
        }
    });

    if (closestWall !== undefined)
        return {t: minT, wall: closestWall, wallT: wallT}
    return undefined;
};

var drawColumns = function(canv, hits) {
    var hit, x, h, color,
        ctx = canv.getContext('2d'),
        dAng = player.fov / canv.width, ang,
        tex, wallx;

    ctx.lineWidth = 1;

    for (var i = 0; i < canv.width; i++) {
        ang = dAng * (i - canv.width / 2);
        x   = i + 0.5;

        // 1. draw sky
        ctx.beginPath();
        ctx.strokeStyle = '#8080FF';
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canv.height / 2);
        ctx.stroke();

        // 2. draw ground
        ctx.beginPath();
        ctx.strokeStyle = '#FF8000';
        ctx.moveTo(x, canv.height / 2);
        ctx.lineTo(x, canv.height);
        ctx.stroke();

        // 3. draw wall if necessary
        hit = hits[i];
        if (hit === undefined)
            continue;

        h = (canv.height * 0.25) / (hit.t * Math.cos(ang));
        if (h <= 0)
            continue;

        if (!hit.wall.texture) {
            color = hit.wall.color;
            if (hit.t > 1)
                    color = color.intensify(1 / hit.t);

            ctx.beginPath();
            ctx.strokeStyle = color.canvasColor;
            ctx.moveTo(x, (canv.height - h) / 2);
            ctx.lineTo(x, (canv.height + h) / 2);
            ctx.stroke();
        }
        else {
            tex   = hit.wall.texture;
            wallx = Math.round(tex.width * hit.wallT) % tex.width;
            ctx.drawImage(
                tex,
                wallx, 0, 1, tex.height,
                i, (canv.height - h) / 2, 1, h);

            if (hit.t > 1) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(0,0,0,' + (1 - 1 / hit.t) + ')';
                ctx.moveTo(x, (canv.height - h) / 2);
                ctx.lineTo(x, (canv.height + h) / 2);
                ctx.stroke();
            }
        }
    }
};

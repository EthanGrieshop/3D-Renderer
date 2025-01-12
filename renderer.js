var canvas = document.getElementById("gameplay");
var ctx = canvas.getContext("2d");
var renderedObjects = [];

const FOV = 120 * Math.PI / 180;
var canvasWidth = 1;
var canvasHeight = 1;

const translationalSensitivity = 0.33;
const rotationalSensitivity = 0.1;

var blues = [
    "rgb(74, 106, 234)",
    "rgb(44, 77, 207)",
    "rgb(25, 56, 180)",
    "rgb(17, 43, 149)",
    "rgb(10, 30, 111)",
    "rgb(5, 17, 65)"
];

var greens = [
    "rgb(142, 218, 156)",
    "rgb(108, 210, 127)",
    "rgb(44, 178, 68)",
    "rgb(18, 131, 39)",
    "rgb(9, 90, 24)",
    "rgb(4, 50, 13)"
];

function resetCanvas() {
    ctx.canvas.width = window.innerWidth-30;
    ctx.canvas.height = window.innerHeight-30;

    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;

    ctx.fillStyle = "rgb(255,255,255)";
    ctx.strokeStyle = "rgb(255,255,255)";

    ctx.fillRect(0,0,canvasWidth,canvasHeight);
}

function clamp(val, min, max) {
    return Math.min(Math.max(min,val),max);
}

function getVerticalFOV() {
    return canvasHeight/canvasWidth * FOV;
}

function getDistance(p1, p2) {
    return Math.sqrt((p2.x-p1.x)**2+(p2.y-p1.y)**2+(p2.z-p1.z)**2);
}

function getAngle(viewPoint, p, theta, phi) {
    var dot = (p.x-viewPoint.x)*Math.cos(theta)*Math.sin(phi)+(p.y-viewPoint.y)*Math.sin(theta)*Math.sin(phi)+(p.z-viewPoint.z)*Math.cos(phi);
    return Math.acos(dot / getDistance(p, viewPoint));
}

function isForwardFacing(p, viewPoint, theta, phi) {
    var a = getAngle(viewPoint, p, theta, phi);
    return getAngle(viewPoint, p, theta, phi) < Math.PI/2;
}

class Point2d {
    constructor(x,y) {
        this.x = x;
        this.y = y;
    }
}

class Point3d {
    constructor(x,y,z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    to2d(viewPoint, theta, phi) {
        var xAngleDifference = theta-Math.atan2(this.y-viewPoint.y, this.x-viewPoint.x); 
        var yAngle = Math.PI/2-Math.asin((this.z-viewPoint.z)/(getDistance(viewPoint, this)));
        //var x = xAngleDifference*canvasWidth/FOV+canvasWidth/2;
        var x2 = -canvasWidth*Math.tan(xAngleDifference)/(2*Math.tan(FOV))+canvasWidth/2;
        //var y = (yAngle-phi)*canvasHeight/getVerticalFOV()+canvasHeight/2;
        var y2 = Math.tan(yAngle-phi)*canvasHeight/(2*Math.tan(getVerticalFOV()))+canvasHeight/2;
        return new Point2d(x2,y2);
    }
}

class Triangle {
    constructor(p1, p2, p3, color) {
        this.p1 = p1;
        this.p2 = p2;
        this.p3 = p3;
        this.color = color;
    }

    render(viewPoint, theta, phi) {
        if (isForwardFacing(this.p1, viewPoint, theta, phi) && isForwardFacing(this.p2, viewPoint, theta, phi) && isForwardFacing(this.p3, viewPoint, theta, phi)) {
            ctx.fillStyle = this.color;
            ctx.strokeStyle = this.color;
            ctx.beginPath();
            var pts = [
                this.p1.to2d(viewPoint, theta, phi),
                this.p2.to2d(viewPoint, theta, phi),
                this.p3.to2d(viewPoint, theta, phi)
            ];

            ctx.moveTo(pts[0].x,pts[0].y);
            ctx.lineTo(pts[1].x,pts[1].y);
            ctx.lineTo(pts[2].x,pts[2].y);
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
        }
    }

    distanceFromCamera(viewPoint) {
        var avg = new Point3d(
            (this.p1.x+this.p2.x+this.p3.x)/3,
            (this.p1.y+this.p2.y+this.p3.y)/3,
            (this.p1.z+this.p2.z+this.p3.z)/3
        );
        return getDistance(avg, viewPoint);
    }
}

class RectangularPrism {
    constructor(p1, p2, type) {
        var mins = [Math.min(p1.x,p2.x),Math.min(p1.y,p2.y),Math.min(p1.z,p2.z)];
        var maxes = [Math.max(p1.x,p2.x),Math.max(p1.y,p2.y),Math.max(p1.z,p2.z)];
        var points = [
            new Point3d(mins[0],mins[1],mins[2]),
            new Point3d(mins[0],mins[1],maxes[2]),
            new Point3d(mins[0],maxes[1],mins[2]),
            new Point3d(mins[0],maxes[1],maxes[2]),
            new Point3d(maxes[0],mins[1],mins[2]),
            new Point3d(maxes[0],mins[1],maxes[2]),
            new Point3d(maxes[0],maxes[1],mins[2]),
            new Point3d(maxes[0],maxes[1],maxes[2])
        ];

        var colors = [];
        if (type == "blue") {
            colors = blues;
        } else if (type == "green") {
            colors = greens;
        }

        this.triangles = [
            //Top
            new Triangle(points[1],points[3],points[5],colors[0]),
            new Triangle(points[3],points[5],points[7],colors[0]),
            //Front
            new Triangle(points[0],points[1],points[2],colors[1]),
            new Triangle(points[1],points[2],points[3],colors[1]),
            //Left
            new Triangle(points[0],points[1],points[4],colors[2]),
            new Triangle(points[1],points[4],points[5],colors[2]),
            //Right
            new Triangle(points[2],points[3],points[6],colors[3]),
            new Triangle(points[3],points[6],points[7],colors[3]),
            //Back
            new Triangle(points[4],points[5],points[6],colors[4]),
            new Triangle(points[5],points[6],points[7],colors[4]),
            //Bottom
            new Triangle(points[0],points[2],points[4],colors[5]),
            new Triangle(points[2],points[4],points[6],colors[5])
        ];

    }

    averageDistance(viewPoint) {
        var avg = 0;
        for (var i = 0; i < 12; i++) {
            avg+=this.triangles[i].distanceFromCamera(viewPoint)/12;
        }
        return avg;
    }

    render(viewPoint, theta, phi) {
        this.triangles.sort((a,b) => {
            return b.distanceFromCamera(viewPoint)-a.distanceFromCamera(viewPoint);
        });

        for (var i = 0; i < 6; i++) {
            this.triangles[2*i].render(viewPoint,theta,phi);
            this.triangles[2*i+1].render(viewPoint,theta,phi);
        }
    }
}

class Block {
    constructor(coordinates, type) {
        this.coordinates = coordinates;
        this.type = type;

        this.x = coordinates.x;
        this.y = coordinates.y;
        this.z = coordinates.z;

        this.rectangularPrism = new RectangularPrism(coordinates, new Point3d(this.x+1,this.y+1,this.z+1), this.type);
    }

    averageDistance(viewPoint) {
        return getDistance(viewPoint, new Point3d(this.x+0.5,this.y+0.5,this.z+0.5));
    }

    render(viewPoint, theta, phi) {
        this.rectangularPrism.render(viewPoint, theta, phi);
    }
}

var playerPosition = new Point3d(-1,5.6,2);
var playerTheta = 0;
var playerPhi = Math.PI/2+0.05;

var blocks = [];

// blocks.push(new Block(new Point3d(4,0,0), "blue"));
// blocks.push(new Block(new Point3d(4,2,0), "green"));

if (true) {
    for (var i = 0; i < 35; i++) {
        for (var j = 0; j < 35; j++) {
            blocks.push(new Block(new Point3d(i+3,j+3,0), ((i+j)%2==0)? "green" : "blue"));
        }
    }
}

function mainLoop() {

    resetCanvas();
    blocks.sort((a,b) => b.averageDistance(playerPosition)-a.averageDistance(playerPosition));

    for (var i = 0; i < blocks.length; i++) {
        blocks[i].render(playerPosition, playerTheta, playerPhi);
    }

}

mainLoop();

window.addEventListener("resize", () => {
    mainLoop();
});

document.addEventListener("keydown", (event) => {
    var keyName = event.key;

    if (keyName == "s") {
        playerPosition = new Point3d(playerPosition.x-translationalSensitivity*Math.cos(playerTheta), playerPosition.y-translationalSensitivity*Math.sin(playerTheta), playerPosition.z);
    } else if (keyName == "d") {
        playerPosition = new Point3d(playerPosition.x+translationalSensitivity*Math.sin(playerTheta), playerPosition.y-translationalSensitivity*Math.cos(playerTheta), playerPosition.z);
    } else if (keyName == "a") {
        playerPosition = new Point3d(playerPosition.x-translationalSensitivity*Math.sin(playerTheta), playerPosition.y+translationalSensitivity*Math.cos(playerTheta), playerPosition.z);
    } else if (keyName == "w") {
        playerPosition = new Point3d(playerPosition.x+translationalSensitivity*Math.cos(playerTheta), playerPosition.y+translationalSensitivity*Math.sin(playerTheta), playerPosition.z);
    } else if (keyName == "Shift") {
        playerPosition = new Point3d(playerPosition.x,playerPosition.y,playerPosition.z-translationalSensitivity);
    } else if (keyName == " ") {
        playerPosition = new Point3d(playerPosition.x,playerPosition.y,playerPosition.z+translationalSensitivity);
    } else if (keyName == "ArrowUp") {
        playerPhi-=rotationalSensitivity;
        playerPhi = clamp(playerPhi, 0, Math.PI);
    } else if (keyName == "ArrowDown") {
        playerPhi+=rotationalSensitivity;
        playerPhi = clamp(playerPhi, 0, Math.PI);
    } else if (keyName == "ArrowLeft") {
        playerTheta+=rotationalSensitivity;
        if (playerTheta >= Math.PI) {
            playerTheta-=Math.PI*2;
        } else if (playerTheta < -Math.PI) {
            playerTheta+=Math.PI*2;
        }
    } else if (keyName == "ArrowRight") {
        playerTheta-=rotationalSensitivity;
        if (playerTheta >= Math.PI) {
            playerTheta-=Math.PI*2;
        } else if (playerTheta < -Math.PI) {
            playerTheta+=Math.PI*2;
        }
    }

    console.log(playerPosition.x + ", " + playerPosition.y + ", " + playerPosition.z);

    mainLoop();
});


const d2r = Math.PI/180;
const r2d = 180/Math.PI;

class PolarVector {
        constructor (r, phi) {
                this.r = r;
                this.phi = phi;
        }
        add (v) {
                var x = this.r * Math.cos(this.phi * d2r) + v.r * Math.cos(v.phi * d2r);
                var y = this.r * Math.sin(this.phi * d2r) + v.r * Math.sin(v.phi * d2r);
                var phi = r2d * Math.atan2(y, x);
		if (phi < 0) phi += 360;
                var r = Math.sqrt (x**2 + y**2);
                return new PolarVector(r, phi);
        }
        multiply (m) {
                var r = this.r * m;
                return new PolarVector(r, this.phi);
        }
}



currentSpring  = new PolarVector (2.29, 69);
console.log (currentSpring )
currentNeap = new PolarVector (1.29, 69);
console.log (currentNeap)

factor = -0.1377091101362992
factor = -0.5

current = currentSpring.multiply(1-factor).add(currentNeap.multiply(factor));

console.log(current)


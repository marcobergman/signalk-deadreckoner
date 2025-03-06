const path = require('path')
const fs = require('fs')
const csv = require('fast-csv');
const geolib = require('geolib')

const tides = [];
const diamonds = [];

function loadTides() {
  const directory = path.join("tides")
  console.log("Loading tides from " + directory);
  fs.readdir(directory, function (err, files) {
	  files.forEach(function (file, index) {
		console.log (path.join(directory, file))
		fs.createReadStream(path.join(directory, file))
			.pipe(csv.parse({ headers: ["date", "time"], 
				strictColumnHandling: false, delimiter: ";", ignoreEmpty:true, discardUnmappedColumns:true }))
			.on('error', error => console.error("Error when processing file " + fileName+ ": " + error))
			.on('data', row => {
				//console.log(file.split(".")[0], row.date, row.time);
				tides.push({"station": file.split(".")[0], "date": row.date, "time": row.time});
			})
	  })
  });
}


function timeDiff (t) {
	n = new Date();
	t = new Date(t.substring(0,4), parseInt(t.substring(5,7))-1, t.substring(8,10), t.substring(10,12), t.substring(13,15), 1)
	return (t-n)/60000/60 // time difference in hours
}


function loadDiamonds() {
  const directory = path.join("diamonds")
  console.log("Loading diamonds from " + directory);
  fs.readdir(directory, function (err, files) {
	  files.forEach(function (file, index) {
		diamondString = fs.readFileSync(path.join(directory, file), 'utf8')
		diamond = JSON.parse(diamondString)
		diamonds.push(diamond)
	  })
	});
}


function findHoursToHW (station) {
	console.log ("findHoursToHW", station);
	for (let i = 0; i < tides.length; i++) {
		entry = tides[i]
		if (entry.station == station) {
			diff = - timeDiff (entry.date + entry.time)
			//if (entry.station == "Dover") console.log(entry, diff);
			if (Math.abs(diff) <= 6.5) {
				console.log("High Water", station, entry.date + " " + entry.time, "now", diff, "hours ago")
				return (diff)
			}
		}
	}
	return 87;
}

function getSpringNeapFactor (today) {
	// calculate factor: 0 = at Spring, 1 = at Neap
	firstSpring = new Date (2020, 03-1, 11, 13, 48); // month is 0-based!
	springPeriod = 14.765292; // half synodic month (wiki)
	daysAfterFirstSpring = (today - firstSpring) / 1000 / 3600 / 24; // days
	periodsAfterFirstSpring = daysAfterFirstSpring / springPeriod;
	periodsAfterLatestSpring = periodsAfterFirstSpring - Math.floor(periodsAfterFirstSpring);
	if (periodsAfterLatestSpring > 0.5) {periodsAfterLatestSpring = periodsAfterLatestSpring - 1}
	//console.log ("periodAfterLatestSpring", periodsAfterLatestSpring);
	return (periodsAfterLatestSpring);
}


function round(i) {
	return Math.round(i*1000)/1000;
}


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
		toString() {
			return {"r": round(this.r), "phi": round(this.phi)};
		}
}


function calculateDiamondCurrent (diamond, springNeapFactor, i_diff) {
	console.log ("----------------------");
	console.log ("calculateDiamondCurrent (", diamond.reference, springNeapFactor, i_diff, ")")
	diff = findHoursToHW (diamond.reference);
	//diff = i_diff; //temporary
	floor = Math.floor(diff)
	index1 = floor + 6;
	index2 = floor + 7;
	if (index1 < 0) index1=12;
	if (index1 > 12) index1=0;
	console.log("- Floor =", floor, "index1 =", index1, "index2 =", index2)
	lowerDirection = diamond.entries[index1].direction
	higherDirection = diamond.entries[index2].direction
	factor = diff - floor;
	lowerCurrentSpring = new PolarVector(diamond.entries[index1].speed_spring, lowerDirection)
	higherCurrentSpring = new PolarVector(diamond.entries[index2].speed_spring, higherDirection)
	lowerCurrentNeap = new PolarVector(diamond.entries[index1].speed_neap, lowerDirection)
	higherCurrentNeap = new PolarVector(diamond.entries[index2].speed_neap, higherDirection)
	console.log ("- lowerCurrentSpring", lowerCurrentSpring.toString(), "higherCurrentSpring", higherCurrentSpring.toString(), "lowerCurrentNeap", lowerCurrentNeap.toString(), "higherCurrentNeap", higherCurrentNeap.toString());
	currentSpring = lowerCurrentSpring.multiply(1-factor).add(higherCurrentSpring.multiply(factor));
	currentNeap = lowerCurrentNeap.multiply(1-factor).add(higherCurrentNeap.multiply(factor));
	current = currentSpring.multiply(1-springNeapFactor).add(currentNeap.multiply(springNeapFactor));
	console.log ("- Factor", round(factor), "CurrentSpring", currentSpring.toString(), "CurrentNeap", currentNeap.toString(), "Current", current.toString());
	return {"speed": current.r, "direction": current.phi}
}

function calc_distance(lat1, lon1, lat2, lon2) {
  return geolib.getDistance(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 },
    0.1
  )
}

function calculateBoatCurrent (vesselPosition) {
  // First determine which of the diamonds we're going to use. Store them in chosenDiamonds.
  chosenDistance = 0
  chosenDiamonds = []
  nearestDiamond = []
  
  for (i=0; i<3; i++) {
	minimalDistance  = 10000000;
	for (let k=0; k < diamonds.length; k++) {
		distanceToDiamond = calc_distance (
			vesselPosition.latitude, vesselPosition.longitude,
			diamonds[k].position.latitude, diamonds[k].position.longitude);
		console.log(i, vesselPosition, diamonds[k].position, diamonds[k].reference, 
			Math.round(distanceToDiamond/1852, 3), k)
		if (distanceToDiamond < minimalDistance && distanceToDiamond > chosenDistance) {
			nearestDiamond = k
			minimalDistance = distanceToDiamond
		}
	}
	chosenDistance = minimalDistance
	chosenDiamonds.push({"diamond": nearestDiamond, "distance": minimalDistance/1852}) 
	// just an array of indexes into diamonds, augmented with distances
  }
  
  // Then, for each of these chosen diamonds, calculate the current, and average them
  springNeapFactor = getSpringNeapFactor (new Date()) // 0 if we are at spring, 1 if we are at neap.
  
  var currentSum = new PolarVector(0,0);
  var divider = 0;
  
  for (let j=0; j < chosenDiamonds.length; j++) {
	  diamond = diamonds[chosenDiamonds[j].diamond];
	  distance = chosenDiamonds[j].distance
	  let {speed, direction} = calculateDiamondCurrent(diamond, springNeapFactor, 0);
	  thisCurrent = new PolarVector(speed, direction);
	  console.log(diamond.reference, "thisCurrent", thisCurrent.toString(), "distance", distance)
	  
	  weighingFactor = 1 / distance;

	  currentSum = currentSum.add(thisCurrent.multiply(weighingFactor));

	  divider += weighingFactor;
  }
  
  var averageCurrent = currentSum.multiply(1/divider);
  
  console.log ("averageCurrent", averageCurrent.toString());
}

loadTides()
loadDiamonds()

const readline = require('node:readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
rl.question(`What's your name?\n`, name => {
  //console.log (findHoursToHW("Dover"));
  //console.log (findHoursToHW("Plymouth"));
  //console.log (findHoursToHW("Vlissingen"));
  //calculateDiamondCurrent(diamonds[0], getSpringNeapFactor(new Date()), 0)
  //calculateBoatCurrent ({"latitude": 51.44, "longitude": 3.7})
  calculateBoatCurrent ({"latitude": 52.89765333333333, "longitude": 4.323653333333334})
  rl.close();
});




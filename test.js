const path = require('path')
const fs = require('fs')
const csv = require('fast-csv');


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
				console.log(file, row.date, row.time);
			})
	  })
  });
}

loadTides()


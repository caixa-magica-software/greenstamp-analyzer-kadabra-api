const axios = require('axios')
const router = require('express').Router()
const multer = require('multer')
const { exec } = require("child_process");
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    fs.mkdirSync('/data/uploads', { recursive: true })
    cb(null, '/data/uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})

const upload = multer({storage: storage})

router.post('/', upload.single("binary"), (req, res) => {
  console.log("Analyzing file:", req.file)
  console.log("Parameters received:", req.body.app)
  const app = JSON.parse(req.body.app)
  const { appName, packageName, version, url, metadata, tests } = app
  if(appName == null || appName == "") res.send(400).send({ message: "appName name cannot be null or empty" });
  else if(packageName == null || packageName == "") res.send(400).send({ message: "packageName name cannot be null or empty" });
  else if(version != null && version == "") res.send(400).send({ message: "version name cannot be null or empty" });
  else if(url != null && url == "" && req.file == null) res.send(400).send({ message: "url and binary cannot be null or empty" });
  else if(metadata != null && metadata == "") res.send(400).send({ message: "metadata name cannot be null or empty" });
  else if(tests != null && tests.length == 0) res.send(400).send({ message: "tests name cannot be null or empty" });
  else {
    execute(req.file.filename, appName, packageName, version, url, metadata, tests)
    res.status(200).send()
  }
})

const execute = (apkFileName, appName, packageName, version, url, metadata, tests) => {
  doTests(apkFileName, tests)
    .then(results => {
      const testResponse = {
        appName: appName,
        packageName: packageName,
        version: version,
        timestamp: Date.now(),
        results: results
      }
      console.log("Sending test response...", testResponse)
      axios.put(process.env.DELIVER_RESULTS_ENDPOINT || "http://localhost:3000/api/result", testResponse)
    })
    .catch(error => console.log("ERROR:", error))
}

const doTests = (apkFileName, tests) => {
  return new Promise((resolve, reject) => {
    exec(`java -jar /data/kadabra/kadabra.jar /data/kadabra/main.js -p /data/uploads/${apkFileName} -WC -APF package! -o output -s -X -C`, (error, stdout, stderr) => {
      if(error) console.log("error:", error)
      if(stdout) console.log("stdout:", stdout)
      if(stderr) console.log("stderr:", stderr)
      fs.readFile('results.json', (err, data) => {
        if (err) reject(err);
        const results = JSON.parse(data);
        const testResults = tests.map(test => {
          const result = Object.keys(results.detectors).find(detector => detector == test.name)
          return {
            name: test.name,
            parameters: test.parameters,
            result: result ? result.length : "NA",
            unit: "warnings"
          }
        })
        console.log("Results for:", apkFileName)
        console.log(testResults)
        // This analyzer does not support arguments to define which analyzers should be used dynamically
        console.log("Should filter for...")
        const testNames = tests.map(test => test.name)
        console.log(testNames)
        console.log("After filtering")
        const filteredTests = testResults.filter((testResult) => testNames.indexOf(testResult.testName) <= 0)
        console.log("Filtered test results:", filteredTests)
        resolve(filteredTests)
      })
    })
  })
}

module.exports = router
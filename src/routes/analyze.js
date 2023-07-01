const axios = require('axios')
const router = require('express').Router()
const multer = require('multer')
const { exec } = require("child_process");
const fs = require('fs');
const https = require('https');


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const resultsDir = process.env.UPLOADS_HOME || "./data/uploads"
    const resultsPath = `${resultsDir}/${Date.now()}`
    console.log("Upload on", resultsPath)
    fs.mkdirSync(resultsPath, { recursive: true })
    cb(null, resultsPath)
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
  const { appName, packageName, version, tests } = app
  const { url, metadata } = app.data
  if(appName == null || appName == "") res.send(400).send({ message: "appName name cannot be null or empty" });
  else if(packageName == null || packageName == "") res.send(400).send({ message: "packageName name cannot be null or empty" });
  else if(version != null && version == "") res.send(400).send({ message: "version name cannot be null or empty" });
  else if(url != null && url == "" && req.file == null) res.send(400).send({ message: "url and binary cannot be null or empty" });
  else if(metadata != null && metadata == "") res.send(400).send({ message: "metadata name cannot be null or empty" });
  else if(tests != null && tests.length == 0) res.send(400).send({ message: "tests name cannot be null or empty" });
  else {
    if(req.file != null) {
      execute(req.file.destination, req.file.path, appName, packageName, version, url, metadata, tests)
      res.status(200).send()
    } else {
      downloadApk(url)
        .then(result => {
          console.log("result.resultsPath: " + result.resultsPath)
          console.log("result.apkPath: " + result.apkPath)
          execute(result.resultsPath, result.apkPath, appName, packageName, version, url, metadata, tests)
          res.status(200).send()
        })
        .catch(error => res.status(500).json({ error: error }))
    }    
  }
})

const downloadApk = (url) => {
  return new Promise((resolve, reject) => {
    const ts = Date.now()
    const resultsDir = process.env.UPLOADS_HOME || "./data/uploads"
    const resultsPath = `${resultsDir}/${ts}`
    fs.mkdirSync(resultsPath, { recursive: true })
    const fileName = `${ts}.apk`
    const output = fs.createWriteStream(`${resultsPath}/${fileName}`)
    console.log("Going to download from:", url)
    console.log("Going to download on:", `${resultsPath}/${fileName}`)
    https.get(url, (res) => {
      console.log('apk download status code:', res.statusCode);
      if(res.statusCode != 200){
        reject({ code: res.statusCode, message: "Error during download" });
        remove(resultsPath)
      } else {
        console.log("Download OK statusCode:", res.statusCode)
      }
      res.pipe(output);
      resolve({ resultsPath: resultsPath, apkPath: `${resultsPath}/${fileName}`})
    }).on('error', (error) => {
      console.log("Error during downlad:", error)
      reject(error)
    });
  })
}

const remove = (resultsPath) => {
  console.log("remove tests for: " + resultsPath)
  // delete directory recursively
  fs.rm(resultsPath, { recursive: true }, err => {
    if (err) {
      throw err
    }

    console.log(`${resultsPath} is deleted!`)
  })
}

const execute = (resultsPath, apkPath, appName, packageName, version, url, metadata, tests) => {
  console.log("Executing tests for:", apkPath)
  const resultsEndpoint = process.env.DELIVER_RESULTS_ENDPOINT || "http://localhost:3000/api/result"
  doTests(resultsPath, apkPath, tests)
    .then(results => {
      const testResponse = {
        appName: appName,
        packageName: packageName,
        version: version,
        timestamp: Date.now(),
        results: results
      }
      console.log("Sending test response...", testResponse)
      try{
        axios.put(resultsEndpoint, testResponse)
      } catch(error){
        console.log("error:" + error)
      }
    })
    .catch(error => console.log("ERROR:", error))
}

const doTests = (resultsPath, apkPath, tests) => {
  return new Promise((resolve, reject) => {
    const kadabraHome = process.env.KADABRA_HOME
    const timeoutStart = Date.now()
    var testTime = 0
    console.log(`cd ${resultsPath} && java -jar ${kadabraHome}/kadabra.jar ${kadabraHome}/main.js -p ${apkPath} -WC -APF package! -o output -s -X -C`);
    exec(`cd ${resultsPath} && java -jar ${kadabraHome}/kadabra.jar ${kadabraHome}/main.js -p ${apkPath} -WC -APF package! -o output -s -X -C`, (error, stdout, stderr) => {
      if(error) console.log("error:", error)
      if(stdout) console.log("stdout:", stdout)
      if(stderr) console.log("stderr:", stderr)
      // Some of apks return error but still creates the results.json file
      fs.readFile(`${resultsPath}/results.json`, (err, data) => {
        if (err) reject(err);
        else {
          const results = JSON.parse(data);
          console.log(results);
          testTime = (Date.now() - timeoutStart) / 1000 / 60
          console.log("Test time (ms): " + (Date.now() - timeoutStart) ) // Test time in seconds
          console.log("Test time (minutes): " + testTime) // Test time in minutes
          const testResults = tests.map(test => {
            const result = Object.keys(results.detectors).find(detector => detector == test.name)
            return {
              name: test.name,
              parameters: test.parameters,
              result: result ? results.detectors[result].length : "NA",
              unit: "detections",
              optional: testTime,
            }
          })
          console.log("Results for:", apkPath)
          console.log(testResults)
          // This analyzer does not support arguments to define which analyzers should be used dynamically
          console.log("Should filter for...")
          const testNames = tests.map(test => test.name)
          console.log(testNames)
          console.log("After filtering")
          const filteredTests = testResults.filter((testResult) => testNames.indexOf(testResult.testName) <= 0)
          console.log("Filtered test results:", filteredTests)
          remove(resultsPath)
          resolve(filteredTests)
        }
      })
    })
  })
}

module.exports = router
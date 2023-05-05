# analyzer-kadabra

## Kadabra env

Declare env variable DELIVER_RESULTS_ENDPOINT with the endpoint which collects the results.
e.g.

```
DELIVER_RESULTS_ENDPOINT=http://51.210.255.156:3000/api/result
```

Declare env variable KADABRA_HOME with the forder of kadabra.
e.g.

```
KADABRA_HOME=/home/campos/git/greenstamp/analyzer-kadabra-api/kadabra
```


## Kadabra software

https://zenodo.org/record/7083540

https://github.com/skylot/jadx

java -jar kadabra.jar main.js -p absolute_path/apk_name.apk -WC -APF package! -o output -s -X -C

NOTE: 

http://specs.fe.up.pt/tools/kadabra.zip

[main.js](uploads/b61a7394513b3a4f2b97fd23ee65c5eb/main.js)

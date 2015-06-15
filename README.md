# Koop-OpenData
[![npm version](https://img.shields.io/npm/v/koop-opendata.svg?style=flat-square)](https://www.npmjs.com/package/koop-opendata)

## A Koop provider for ArcGIS Open Data Search

Koop-OpenData allows you to take any search on ArcGIS Open Data and turn it into a Feature Service, GeoJSON, Shapefile or CSV.

### Getting started

#### Install and run

* To install or use this provider you will first need a working installation of Koop. We recommend [this app](https://github.com/koopjs/koop-sample-app) as an easy way to get started.
* Add Koop-OpenData to the package.json for your app
```json
{
  "name": "koop-sample",
  "version": "1.0.0",
  "description": "A deployable koop application for ArcGIS open data",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "author": "Chris Helm",
  "license": "ISC",
  "repository": {
    "type": "git",
    "url": "https://github.com:chelm/koop-sample-app.git"
  },
  "dependencies": {
    "config": "~1.9.0",
    "cors": "^2.5.2",
    "ejs": "^1.0.0",
    "express": "^4.10.6",
    "koop-opendata": "^1.0.0",
  }
``` 
* Install it as a dependency
```bash
npm install
```
Note: you may need to run this as sudo if it fails
* Register Koop-OpenData as a provider inside your server.js file
```javascript
var openData = require('koop-opendata')
koop.register(opendata)
```
* Start your server
```bash
node server.js
```

#### Register a site that you want to search against.

- Example opendata.dc.gov
``` bash
curl -XPOST 'http://koop.com/openData' -d 'host=http://opendata.dc.gov&id=dc'
```
- Example opendata.arcgis.com
``` bash
curl -XPOST 'http://koop.com/openData' -d 'host=http://opendata.arcgis.com&id=umbrella'
```

#### Start searching

- Example: Zoning datasets on opendata.dc.gov
```bash
curl -XGET 'http://koop.dc.esri.com/openData/dc/q/zoning'
```

- Example: Zoning datasets in the United States on opendata.arcgis.com
```bash
curl -XGET 'http://koop.dc.esri.com/openData/umbrella/q/zoning/place/united+states'
```

- Example: Land use datasets that have the keyword: zoning
```bash
curl -XGET 'http://koop.dc.esri.com/openData/umbrella/q/land+use/keyword/zoning'
```

- Example: Land use datasets, with the keyword zoning, sorted by date updated, in a bounding box
```bash
curl -XGET 'http://koop.dc.esri.com/openData/umbrella/keyword/zoning/sort_by/updated_at/bbox/135%2C1.014%2C-135%2C72.277'
```

* Note: the Koop URL is only for example purposes
* Not used to seeing curl commands? For the -XGET requests simply take the URL and paste it into your browser

### Search parameters

You can use all the search parameters together or choose to use none at all. Just place the parameter name before the one you want to use.

Examples: 
- `/q/water`
- `/keyword/zoning`

Example of chained parameters:
- `/q/water/keyword/zoning`

```json
{
	"q": "a simple query string to search against",
	"keyword": "a keyword tag that must appear in any result",
	"bbox": "a bounding box to restrict results",
	"sort_by": "which way the results should be sorted [relevance, name, updated_at, created_at]",
	"place": "a place to restrict the results to. this place will be geocoded and used as a bounding box"
}
```

### Available formats

Koop-OpenData supports all the same formats as [Koop](http://github.com/esri/koop)

- KML -> simply append `.kml` to the request
- CSV -> append `.csv`
- Shapefile -> append `.zip`
- Feature Server -> append `/FeatureServer/0`
- GeoJSON -> append `.geojson`




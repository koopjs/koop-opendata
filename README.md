# koop-opendata

[![Greenkeeper badge](https://badges.greenkeeper.io/koopjs/koop-opendata.svg)](https://greenkeeper.io/)

> An ArcGIS Open Data Provider for Koop

[![npm version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/koop-opendata.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/koop-opendata

`koop-opendata` allows you to take any search on ArcGIS Open Data and turn it into a Feature Service, GeoJSON, Shapefile or CSV.

## Install

To install or use this provider you will first need a working installation of Koop. We recommend the [`koop-sample-app`](https://github.com/koopjs/koop-sample-app) application template as an easy way to get started.

Add `koop-opendata` as a dependency to the `package.json` of your Node.js project.

```
npm install koop-opendata --save
```

## Usage

`koop-opendata` needs to be registered as a provider in your Koop app in order to work.

```js
var openData = require('koop-opendata')
koop.register(opendata)
```

After that you need to create an `openData:services` table in your spatial database.

```sql
CREATE TABLE "openData:services"
(
  id character varying(100),
  host character varying(100)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE "openData:services"
  OWNER TO username;
```

Once that's done you can restart your server and the Open Data routes will be available.

If you're using the `koop-sample-app` template, you can start the server like this:

```
node server.js
```

### Register a site that you want to search against

- Example opendata.dc.gov
``` bash
curl -XPOST 'http://koop.com/openData' -d 'host=http://opendata.dc.gov&id=dc'
```
- Example opendata.arcgis.com
``` bash
curl -XPOST 'http://koop.com/openData' -d 'host=http://opendata.arcgis.com&id=umbrella'
```

### Start searching

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

koop-opendata supports all the same formats as [Koop](http://github.com/esri/koop)

- KML -> simply append `.kml` to the request
- CSV -> append `.csv`
- Shapefile -> append `.zip`
- Feature Server -> append `/FeatureServer/0`
- GeoJSON -> append `.geojson`

## License

Copyright 2015 Esri

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

> http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

A copy of the license is available in the repository's [license.txt](license.txt) file.

[](Esri Tags: ArcGIS Web Mapping GeoJson FeatureServices)
[](Esri Language: JavaScript)

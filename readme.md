# maplarge-google

Google layer for working with [maplarge](http://maplarge.com/) layers.
Currently very rough, use at own risk.

[![npm version](https://badge.fury.io/js/maplarge-google.svg)](https://badge.fury.io/js/maplarge-google)

```no-highlight
npm install --save maplarge-google
```

## API


The constructor takes several options, many of them mandatory

- `account`
- `table`
- `host`
- `type`: line or point (only needed if type can't be inferred from table name, i.e. ending with `Line` or `Point` like `conditionLine`).
- `subdomains`: number of different subdomains, since the domains are zero indexed this is one more then the max subdomain.
- `minzoom`: default 0.
- `maxzoom`: default 20.
- `click`: handler for click events, mandatory if you want interaction.
- `fields`: array of fields to return to the click function.
- `refresh`: how often to check if the data has been updated (and if so refresh the tiles), if absent then data is not refreshed.
- `sort`: if a field should be used for sorting the features.
- `zindex`: maintaining layer ordering when you have multiple maplarge layers.
- `dissolve`: if you have a point table and want to buffer it based ona certain collumn (in miles) and then disolve the result, pass the field here.

## Methods

- `.setMap` pass it a map object to add it to a map or null to remove it
- `.updateQuery` pass in a maplarge query object to apply that filter to the layer
- `.getInfo` give it a lat, lng, and a zoom and it will give you the info of all the features that were clicked on, taking into account zoom and what not, returns a promise.
- `.query` give it a maplarge query object and it returns a promise for the result.

## Events

- `fullTable`: Emitted when a table version is found and anytime it updates
- `zoom-started`: emitted when a user starts zooming
- `zoom-ended`: emitted when a user finishes zooming

## Example Rules

* a simple rule set visible at all zoom levels

```json
{
  "rules": [
    {
      "style": {
        "antiAliasing": "true",
        "blending": "true",
        "endCap": "Round",
        "fillColor": "255-0-191-0",
        "lineOffset": "5",
        "startCap": "Round",
        "width": "4"
      },
      "where": "CatchAll"
    }
  ]
}
```

* a ruleset that changes at zoom 10

```json
[
  {
    "range": [0, 10],
    "rules":  [
    {
      "style": {
        "antiAliasing": "true",
        "blending": "true",
        "endCap": "Round",
        "fillColor": "255-0-191-0",
        "lineOffset": "5",
        "startCap": "Round",
        "width": "4"
      },
      "where": "CatchAll"
    }
    ]
  },
  {
    "range": [10, 15],
    "rules":  [
    {
      "style": {
        "antiAliasing": "true",
        "blending": "true",
        "endCap": "Round",
        "fillColor": "255-0-191-0",
        "lineOffset": "5",
        "startCap": "Round",
        "width": "4"
      },
      "where": [
        [
          {
            "col": "RAMP",
            "test": "Contains",
            "value": "EXIT"
          }
        ]
      ]
    }
    ]
  }
]
```

## Upgrading to Version 3

The main breaking change for version 3 was a switch to native ES modules.  We also no longer cache the google global so if you had to do any weird delated importing of this module you should be able to import it as a standard ES module at the top of your file.

We also are no longer building compiled versions of this library in the dist folder.  If you were relying on those open an issue.

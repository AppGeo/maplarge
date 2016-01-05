maplarge google
===

Google layer for working with [maplarge](http://maplarge.com/) layers.

Currently very rough, use at own risk

example rules

a simple rule set visible at all zoom levels
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

a ruleset that changes at zoom 10

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


API
===

The constructor takes several options, many of them mandatory

- account
- table
- host
- type: line or point (only needed if type can't be inferred from table name)
- subdomains: number of different subdomains, since the domains are zero indexed this is one more then the max subdomain
- minzoom: default 0
- maxzoom: defualt 20
- click: handler for click events, mandatory if you want interaction
- fields: array of fields to return to the click function
- refresh: how often to check if the data has been updated (and if so refresh the tiles), if absent then data is not refreshed.
- sort: if a field should be used for sorting the features,
- zindex: maintaining layer ordering when you have multiple maplarge layers

Methods
===

- `.setMap` pass it a map object to add it to a map or null to remove it
- `.updateQuery` pass in a maplarge query object to apply that filter to the layer
- `.getInfo` give it a lat, lng, and a zoom and it will give you the info of all the features that were clicked on, taking into account zoom and what not, returns a promise.
- `.query` give it a maplarge query object and it returns a promise for the result.

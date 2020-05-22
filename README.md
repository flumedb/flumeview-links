# flumeview-links

> This is `links.js` from `flumeview-query@6.2.0`

TODO ... more detail


## API

### flumedb.use("links", FlumeViewLinks(indexes, links, version))

`indexes` to use. `links` is an optional function used for mapping a
value into one or more values for the index. `version` must be an
number. When you change `indexes` or `links`, bump the version and the
index will rebuild.

Here we use the name "links", you can use any name.

### flumedb.links.read({query: MFR_query, limit, reverse, live, old, unlinkedValues})

Perform the query! limit, reverse, live, old are stardard as with
other flume streams. `unlinkedValues` is an option that can be used to
include the values not part of the index in the return value.

## License

MIT


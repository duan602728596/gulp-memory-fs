### v1.0.0

* Upgrade all dependencies to the latest version.
* Modify the url of the injected script.
* Fix the request problem of the map file injected into the script.
* `mfs.changed` and `mfs.dest` methods, the default parameter is the directory `dir` of the configured resource.
* Other optimizations.

### v0.6.1

* Use `createFsFromVolume` and `Volume` to create a memory system.

### v0.6.0

* Upgrade `@koa/router` to v9 version.
* Upgrade depends on the latest version.

### v0.5.0

* The memory file system uses `memfs` by default.
* Upgrade depends on the latest version.

### v0.4.0

* Allows the use of `memory-fs` or `memfs` memory file systems through configuration.
* Service can configure mock data.
* Service can configure proxy.
* Socket can listen to multiple pages.

### v0.3.0

* The new port is used when the service's port is occupied.
* When the service starts, the address of the service is displayed.

### v0.2.1

* Adjust the address of the websocket in the browser.

### v0.2.0

* Fixed a serious problem where `socket.io-client` could not be found.

### v0.1.0

* Script injection is done at the time of the file request, not after compilation.
* Add the `reloadTime` parameter to control the delayed refresh time.
* The client script is compiled to the `ES3` version and compressed.

### v0.0.2

* The script is not injected when the `reload` parameter is not `true`.

### v0.0.1

* Initialize the project.
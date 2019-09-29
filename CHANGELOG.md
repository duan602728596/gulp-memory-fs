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
# JSON configuration data

The BitSquid engine will use JSON as an intermediate format for all generic configuration data.

JSON is better than a custom binary format because:

* The data can be inspected and debugged manually.
* There are lots of editors.
* Changes merge nicer in SVN.
* The data is platform independent.
* As long as you are just adding data fields, the data is both backward and forward compatible.

JSON files are slower to parse than binary files, but that doesn't matter because it is only an intermediate format. They are bigger, but not that much bigger, and again it doesn't matter because it is only an intermediate format. We will generate efficient binary data for the runtime.

JSON is better than XML because:

* It is a lot simpler and easier to parse.
* It maps directly to native data structures.
* It is typed, meaning you can understand (more of) it without needing a DTD.
* It is more "normalized". (In XML you have to choose whether to put information in attributes or in text nodes.

XML is good for marking up text, but not so good for describing data.
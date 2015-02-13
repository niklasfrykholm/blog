# Simplified JSON notation

JSON is human-editable, but not necessarily human-friendly. A typical JSON configuration file:

```json
{
    "ip" : "127.0.0.1",
    "port" : 666
}
```

A more Lua-inspired syntax is friendlier:

```
ip = "127.0.0.1"
port = 666
```

This syntax corresponds 1-1 with regular JSON syntax and can be trivially converted back and forth with the following rules:

* Assume an object definition at the root level (no need to surround entire file with `{ }` ).
* Commas are optional
* Quotes around object keys are optional if the keys are valid identifiers
Replace : with =

On the other hand, all syntax wars are pointless and will only send us into an early grave.

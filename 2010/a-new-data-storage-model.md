# A new data storage model

In my head, I am toying with an idea of a new data storage model that combines the flexibility and simplicity of JSON with the multi-user friendliness of a traditional database.

The basic idea is as follows:

* A database is a collection of objects.
* Each object is identified by a GUID.
* An object consists of a set of key-value pairs.
* The keys are always strings.
* A value can be one of:
  * null (this is the same as the key not existing)
  * true/false
  * a number
  * a string
  * a generic data blob (texture, vertex data, etc)
  * a reference to another object (GUID)
  * a set of references to other objects (GUIDs)
* A special object with GUID 0000-00000000-0000 acts as the root object of the database.
* 
This simple setup has many nice properties.

It is easy to map objects back and forth between this storage representation and an in-memory representation in C++, C#, Lua, etc.

We can perform referential integrity checks on the GUIDs to easily locate "dangling pointers" or "garbage objects".

We can add new fields to objects and still be "backwards compatible" with old code.

It is easy to write batch scripts that operate on the database. For example, we can lookup the key "textures" in the root object to find all texture objects and then loop over them and examine their "height" and "width" to find any non-power-of-two textures.

All modifications to the data can be represented by a small set of operations:

    create(guid)
    destroy(guid)
    change_key(guid, key, value)
    add_to_set(guid, key, object_guid)
    remove_from_set(guid, key, object_guid)

These operations can also be used to represent a *diff* between two different versions of the database.

A user of the database can have a list of such operations that represents her local changes to the data (for testing purposes, etc). She can then commit all or some of these local changes to the central database. The database can thus be used in both online and offline mode. Versioning and branching systems can be built on this without too much effort.

Merge conflicts are eliminated in this system. The only possible conflict is when two users have changed the same key of the same object to two different values. In that case we resolve the conflict by letting the later change overwrite the value of the earlier one.

Note that this model only supports sets, not arrays. The reason is that array reordering operations are tricky to merge and in most cases the order of objects does not matter. In the few cases where order really does matter, you can use a key in the objects to specify the sort order.
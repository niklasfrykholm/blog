# Universal Undo, Copy and Paste

Undo, Copy and Paste are the bane of any tools programmer. Especially when they are bolted on to an already existing program. But even when they are properly planned from the start, these small (but essential) features can consume a lot of development time and be the source of many bugs.

Wouldn't it be nice if all that could be eliminated?

In an [earlier post](http://altdevblogaday.org/2011/03/27/collaboration-and-merging/) I presented a generic model for storing data: objects-with-properties. As any model it consists of a combination of generalizations and restrictions. The generalizations make the model broadly applicable. The restrictions let us reason about it and prevents it from becoming an ["inner platform"](http://en.wikipedia.org/wiki/Inner-platform_effect).

To quickly recap, here is the gist of the model:

* The data consists of a set of objects-with-properties.

* Each object is identified by a GUID.

* Each property is identified by a string.

* The property value can be null, a bool, a double, a vector3, a quaternion, a string, a data blob, a GUID or a set of GUIDs.

* The data has a root object with GUID 0.

We need only five operations to manipulate data stored using this model:

**create(guid)**
> creates the object with the specified GUID

**destroy(guid)**
> destroys the object with the specified GUID
 
**set_property(guid, key, value)**
> sets the specified property of the object to the value (set to nil to remove the property)

**add_to_set(guid, key, item_guid)**

> adds the item to the GUID set property identified by the key

**remove_from_set(guid, key, item_guid)**
> removes the item from the GUID set property identified by the key

The interesting thing about this model is that it is generic enough to represent almost any kind of data, yet restricted enough to make it possible to define and perform a variety of interesting operations on the data. For example, in the previous post we saw that it was possible to define a property-based merge operation on the data (which for content files is much more useful than the line-based merge used by most version control systems).

Other operations that are easy to perform on this data are:

* referential integrity checks (check that all GUIDs used exist in the database)

* checks for "dangling" objects

* object replacement (replace all references to an object's GUID with references to another object)

And, of course, the topic for the day: Undo, Copy and Paste.

## Undo

To implement undo in this model, note that each of the five mutating operations we can perform on the data has a simple inverse:

| Operation | Inverse |
| --------- | ------- |
| create(guid) | destroy(guid) |
| destroy(guid) | create(guid) |
| set_property(guid, key, value) | set_property(guid, key, old_value) |
| add_to_set(guid, key, item_guid) | remove_from_set(guid, key, item_guid) |
| remove_from_set(guid, key, item_guid) | add_to_set(guid, key, item_guid) |

To implement Undo, all we have to do is to make sure that whenever the user performs one of the mutating operations, we save the corresponding inverse operation to a stack. To undo the latest action, we pop that last action from the stack and perform it. (We also save its inverse operation to a redo queue, so the user can redo it.)

Since the Undo operation is implemented on the low-level data model, all high-level programs that use it will automatically get "Undo" for free.

In the high level program you typically want to group together all the mutations that resulted from a single user action as one "undo item", so the user can undo them with a single operation. You can do that by recording "restore points" in the undo stack whenever your program is idle. To undo an action, you undo all operations up to the last restore point.

## Copy

To copy a set of objects, create a new database that holds just the copied objects. Copy the objects with their keys and values to the new database. Also copy all the objects they reference. (Use a set to remember the GUIDs of the objects you have already copied.)

In the root object of the new database, store the GUIDs of all the copied objects under some suitable key (for example: "copied-models").

Then serialize the database copy to the clipboard (using your standard method for serialization).

## Paste

To paste data, first unserialize it from the clipboard to a new temporary database. Then rename all the objects (give them new GUIDs) to make sure they don't collide with existing objects.

Renaming is simple, just generate a new GUID for every object in the database. Use a dictionary to record the mapping from an object's old GUID to the new GUID. Then, using that dictionary, translate all the references in the object properties from the old GUIDs to the new ones.

Finally, copy the objects from the temporary database to your main database.

Again, since Copy and Paste were implemented on the underlying data model and don't depend on the high level data (what kind of objects you actually store) you get them for free in all programs that use the data model.
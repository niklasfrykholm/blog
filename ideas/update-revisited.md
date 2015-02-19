# update() revisited

- Separate systems, each system updates separately, scene graph is one such system.

Three methods of update.

* one big scene graph

* ->update() on all objects

*  if (is_dirty()) update(); (bit flag in object)

*  if (is_dirty(i)) objects->update(i) (bit flag in manager - better!)

```
// Best - no extra processing for objects that are not updated
foreach (object_that_needs_update)
 o->update();
```

Maintaining the list - O(1) insertion, O(1) removal, O(1) identity

Suggestion:

* All objects:  [1 10 11 2 7 3 4 5 9 22 13 ]
* Count of objects that needs updates: 3
* Each object knows its index in this list.

* Is in list: index < fence
* Add to list: swap(index, fence) ++fence
* Remove from list: swap(index, fence) --fence

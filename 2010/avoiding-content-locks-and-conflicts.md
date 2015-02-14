# Avoiding Content Locks and Conflicts -- 3-way Json Merge

Locking content files in a CVS is annoying, doesn't scale well and prevents multiple people from working on different parts of the same level (unless you split the level in many small files which have to be locked individually -- which is even more annoying).

But having content conflicts is no fun either. A level designer wants to work in the level editor, not manage strange content conflicts in barely understandable XML-files. The level designer should never have to mess with WinMerging the engine's file formats.

And conflicts shouldn't be necessary. Most content conflicts are not *actual* conflicts. It is not that often that two people have moved the exact same object or changed the exact same settings parameter. Rather, the conflicts occur because a line-based merge tool tries to merge hierarchical data (XML or JSON) and messes up the structure.

In those rare cases when there is an actual conflict, the content people don't want to resolve it in WinMerge. If two level designers have moved the same object, we don't really help them address the issue by bringing up a dialog box with a ton of XML mumbo-jumbo. Instead, it is much better to just pick one of the two locations and go ahead with merging the file. Then, the level designers can fix any problems that might have occurred in the level editor -- the right tool for the job.

At BitSquid we use JSON for all our content files (actually, a slightly simplified version of JSON that we call SJSON). So to get rid of our conflict issues, I have written a 3-way merger that understands the structure of JSON files and resolves any remaining actual conflicts by always picking the right-hand branch.

If we disregard arrays for the moment, merging JSON files is quite simple. A diff between two JSON files can be expressed as a list of *object[key] = value* operations. Deleting a key is represented by changing its value to *null*. Adding a key is represented by changing a *null* value to something else. Merging these operations is simple. We only have trouble when the same key in the same object is changed to two different values, but then we just pick one of the values, as explained above.

Arrays are trickier because without context, it is impossible to tell what a change to an array means semantically. If the array [1, 2, 3] is changed to [1, 2, 4] is that a single operation that changed the last value from 3 to 4. Or is it two operations, deleting the 3 from the array and inserting 4. How we interpret it will affect the result of our 3-way merges. For example, the 3-way merge of [1, 2, 3], [1, 2, 4] and [1, 2, 5] can give either the result [1, 2, 5] or [1, 2, 4, 5].

I have resolved this by adding extra information to the arrays in our source files. Most of our arrays are arrays of objects. For such arrays, I require that the objects have an "id"-field with a GUID that uniquely identifies the object. With such an id in our array [ {x = 1, id = a}, {x = 2, id = b}, {x = 3, id = c} ] it becomes possible to distinguish between updating an existing value  [ {x = 1, id = a}, {x = 2, id = b}, {x = 4, id = c} ] and removing + adding a value [ {x = 1, id = a}, {x = 2, id = b}, {x = 4, id = d} ].

The 3-way merge algorithm I'm using applies some heuristics to guess array transformations even when no id-field is present, but the recommendation is to always add id-fields to array elements to get perfect merges.

You can download my 3-way Json merger [here](http://www.bitsquid.se/files/json_merge.7z). I just wrote it today, so it haven't received much testing yet. But it is public domain software, so free free to fix the bugs and do whatever else you like with it.
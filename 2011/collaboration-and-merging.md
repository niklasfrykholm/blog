# Collaboration and Merging

Games are huge collaborative efforts, but usually they are not developed that way. Mostly, assets can only be worked on by one person at a time and need to be locked in version control to prevent conflicting changes. This can be a real time sink, especially for level design, but all assets would benefit from more collaborative workflows. As tool developers, it is time we start thinking seriously about how to support that.

Recently I faced this issue while doing some work on our localization tools. (Localization is interesting in this context because it involves collaboration over long distances -- a game studio in one country and a translation shop in another.) In the process I had a small epiphany: the key to collaboration is merging. When data merges nicely, collaborative work is easy. If you can't merge changes it is really hard to do collaboration well, no matter what methods you use.

## Why databases aren't a magic solution

A central database can act as backend storage for a collaborative effort. But that, by itself, does not solve all issues of synchronization and collaboration.

Consider this: if you are going to use a database as your only synchronization mechanism then all clients will have to run in lockstep with the database. If you change something, you have to verify with the database that the change hasn't been invalidated by something done by somebody else, perform the change as a single transaction and then wait for the database to acknowledge it before continuing. Every time you change something, you will have to wait for this round trip to the database and the responsiveness of your program is now completely at its mercy.

Web applications have faced this issue for a long time and they all use the same solution. Instead of synchronizing every little change with the database, they gather up their changes and send them to the database asynchronously. This change alone is what have made "web 2.0" applications competitive with desktop software.

But once you start talking to the database asynchronously, you have already entered "merge territory". You send your updates to the server, they arrive at some later point, potentially after changes made by other users. When you get a reply back from the server you may already have made other, potentially conflicting, changes to your local data. Both at the server and in the clients, changes made by different users must be merged.

So you need merging. But you don't necessarily need a database. If your merges are robust you can just use an ordinary version control system as the backend instead of a database. Or you can work completely disconnected and send your changes as patch files. The technology you use for the backend storage doesn't matter that much, it is the ability to merge that is crucial.

A merge-based solution has another nice property that you don't get with a "lockstep database": the possibility of keeping a local changeset and only submitting it to others when it is "done". This is of course crucial for code (imagine keeping all your source files in constantly mutating Google Documents). But I think it applies to other assets as well. You don't want half-finished, broken assets all over your levels. An update/commit workflow is useful here as well.

## Making assets mergable

If you have tried to merge assets in regular version control systems you will know that they usually don't do so well. The merge tool can mess up the JSON/XML structure, mangle the file in other ways or just plain fail (because of a merge conflict). All of these problems arise because the merge tool treats the data as "source code" -- a line-oriented text document with no additional structure. The reason for this is of course historic, version control systems emerged as a way of managing source code and then grew into other areas.

The irony of this is that source code is one of the hardest things to merge. It has complicated syntax and even more complicated semantics. Source code is so hard to merge that even humans with all their intelligency goodness find it taxing. In contrast, most assets are easy to merge, at least conceptually.

Take localization, for instance. The localization data is just a bunch of strings with translations for different languages. If one person has made a bunch of German translations, another person has made some Swedish translations and a third person has added some new source strings, we can merge all that without a hitch. The only time when we have any problem at all is if two people has provided different translations for the same string in the same language. We can solve such standoffs by just picking the most recent value. (Optionally, we could notify the user that this happened by hilighting the string in the tool.)

Many other assets have a similar structure. They can be described as "objects-with-properties". For example, in a level asset the objects are the entities placed in the level and their properties are position, rotation, color, etc. All data that has this structure is easy to merge, because there are essentially just three types of operations you can perform on it: create an object, destroy an object and change a property of an object. All these operations are easy to merge. Again, the only problem is if two different users have changed the same property of the same object.

So when we try to merge assets using regular merge tools we are doing something rather silly. We are taking something that is conceptually very easy to merge, completely ignoring that and trying to merge it using rather complex algorithms that were designed for something completely different, something that is conceptually very hard to merge. Silly, when you think about it.

The solution to this sad state of affairs is of course to write custom merge tools that take advantage of the fact that assets are very easy to merge. Tools that understand the objects-with-properties model and know how to merge that.

A first step might be to write a merge program that understands XML or [JSON](http://bitsquid.blogspot.com/2010/06/avoiding-content-locks-and-conflicts-3.html) files (the program in the link has some performance issues -- I will deal with that in my next available time slot) and can interpret them as objects-with-properties.

This only goes half the way though, because you will need some kind of extra markup in the file for the tool to understand it as a set of objects-with-properties. For example, you probably need some kind of id field to mark object identity. Otherwise you can't tell if a user has changed some properties of an old object or deleted the old object and created a new one. And that matters when you do the merge.

Instead of adding this extra markup, which can be a bit fragile, I think it is better to explicitly represent your data as objects-with-properties. [I've blogged about this before](http://bitsquid.blogspot.com/2010/08/new-data-storage-model.html), but since then I feel my thoughts on the subject have clarified and I've also had the opportunity to try it out in practice (with the localization tool). Such a representation could have the following key elements.

The data consists of a set of objects-with-properties.
Each object is identified by a GUID.
Each property is identified by a string.
The property value can be null, a bool, a double, a vector3, a quaternion, a string, a data blob, a GUID or a set of GUIDs.
The data has a root object with GUID 0.

We use a GUID to identify the object, since that means the ids of objects created by different users won't collide. GUID values are used to make links between objects. Note that we don't allow arrays, only sets. That is because array operations (move object from 5th place to 3rd place) are hard to merge. Set operations (insert object, remove object) are easy to merge.

Here is what a change set for creating a player entity in a level might look like using this model. (I have shortened the GUIDs to 2 bytes to make the example more readable.)

```
create #f341
change_key #f341 "entity-type" "player"
change_key #f341 "position" vector3(0,0,0)
add_to_set #0000 "entities" #f341
```

Note that the root object (which represents the level) has a property "entities" that contains the set of all entities in the level.

To merge two such change sets, you could just append one to the other. You could even use the change set itself as your data format, if you don't want to use a database backend (that is actually what I did for the localization tool).

I think most assets can be represented in the objects-with-properties model and it is a rather powerful way of making sure that they are mergable and collaboration-friendly. I will write all the new BitSquid tools with the object-with-properties model in mind and retrofit it into our older tools.
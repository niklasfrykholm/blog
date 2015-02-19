# What Is In a Name?

Today I'd like to revisit one of the most basic questions when designing a resource system for a game engine:

> How should resources refer to other resources?

It seems like a simple, almost trivial question. Yet, as we shall see, no matter what solution we choose, there are hidden pitfalls along the way.

To give some context to the question, let's assume we have a pretty typical project setup. We'll assume that our game project consists of a number of individual resources stored in a disk hierarchy that is checked into source control.

There are three basic ways of referring to resources that I can think of:

* By path
* By GUID
* By "name"

## By Path

```
texture = "textures/flowers/rose"
```

This is the most straightforward approach. To refer to a particular resource you just specify the path to that resource.

A word of warning: If you use paths as references I would recommend that you *don't* accept ridiculous things such as *"./././models\../textures\FLOWers/////rose"* even though your OS may think that is a perfectly valid path. Doing that will just lead to lots of headaches later when trying to determine if two paths refer to the same resource. Only use a canonical path format, from the root of the project, so that the path to same resource is always the same identical string (and can be hashed).

Path references run into problem when you want to rename a resource:

```
textures/flowers/rose -> textures/flowers/less-sweet-rose
```

Suddenly, all the references that used to point to the *rose* no longer works and your game will break.

There are two possible ways around this:

**Redirects**
> You can do what HTML does and use a *redirect*.

> I.e., when you move *rose*, you put a little placeholder there that notifies anyone who is interested that this file is now called *less-sweet-rose*. Anyone looking for *rose* will know by the redirect to go looking in the new place.

> There are three problems with this, first the disk gets littered with these placeholder files. Second, if you at some point in the future want to create a new resource called *rose*, you are out of luck, because that name is now forever occupied by the placeholder. Third, with a lot of redirects it can be hard to determine when two things refer to the same resource.

**Renaming tool**
> You can use a renaming tool that understands all your file formats, so that when you change the path of a resource, the tool can find all the references to that path and update them to point to the new location.

> Such a tool can be quite complicated to write -- depending on how standardized your file formats are. It can also be very slow to run, since potentially it has to parse all the files in your project to find out which other resources might refer to your resource. To get decent performance, you have to keep an up-to-date cache of the referencing information so that you don't have to read it every time.

> Another problem with this approach can occur in distributed workflows. If one user renames a resource while another creates references to it, the references will break when the changes are merged. (Note that using redirects avoids this problem.)

Both these methods require renames to be done with a tool. If you just change the file name on disk, without going through the tool, the references will break.

## By GUID

The problems with renaming can be fixed by using GUIDs instead of paths. With this approach, each resource specifies a GUID that uniquely identifies it:

```
guid = "a54abf2e-d4a1-4f21-a0e5-8b2837b3b0e6"
```

And other resources refer to it by using this unique identifier:

```
texture = "a54abf2e-d4a1-4f21-a0e5-8b2837b3b0e6"
```

In the compile step, we create an index that maps from GUIDs to compiled resources that we can use to look things up by GUID.

Now files can be freely moved around on disk and the references will always be intact. There is not even a need for a special tool, everything will work automatically. But unfortunately there are still lots of bad things that can happen:

* If a file is *copied* on disk, there will be two files with the same GUID, creating a conflict that needs to be resolved somehow (with a special tool?)

* Lots of file formats that we might want to use for our resources (*.png*, *.wav*, *.mp4*, etc) don't have any self-evident place where we can store the GUID. So the GUID must be stored in a metadata file next to the original file. This means extra files on disk and potential problems if the files are not kept in sync.

* Referring to resources from other resources is not enough. We also need some way of referring to resources from code, and writing:

  ```cpp
  spawn_unit("a54abf2e-d4a1-4f21-a0e5-8b2837b3b0e6")
  ```

  is not very readable.

* If a resource is deleted on disk, the references will break. Also if someone forgets to check in all the required resources, the references will break. This will happen no matter what reference system we use, but with GUIDs, everything is worse because the references:

  ```
  texture = "a54abf2e-d4a1-4f21-a0e5-8b2837b3b0e6"
  ```

  are completely unreadable. So if/when something breaks we don't have any clue what the user meant. Was that resource meant to be a rose, a portrait, a lolcat or something else.

In summary, the big problem is that GUIDs are unreadable and when they break there is no clue to what went wrong.

### By "Name"

Perhaps we can fix the unreadability of GUIDs by using human readable names instead. So instead of a GUID we would put in the file:

> ```
> name = "garden-rose"
> ```

And the reference would be:

> ```
> texture = "garden-rose"
> ```

To me, this approach doesn't have any advantages over using paths. Sure, we can move and rename files freely on disk, but if we want to change the *name* of the resource, we run into the same problems as we did before. Also, it is pretty confusing that a resource has a name and a file name and those can be different.

## By Path and GUID?

Could we get the best of both worlds by combining a path and a GUID?

I.e., the references would look like:

```
texture = {
	path = "textures/flower/rose"
	guid = "a54abf2e-d4a1-4f21-a0e5-8b2837b3b0e6"
}
```

The GUID would make sure that file renames and moves were handled properly. The *path* would give us the contextual information we need if the GUID link breaks. We would also use the path to refer to resources from code.

This still has the issue with needing a metadata file to specify the GUID. Duplicate GUIDs can also be an issue.

And also, if you move a file, the paths in the references will be incorrect unless you run a tool similar to the one discussed above to update all the paths.

## Conclusions

In the Bitsquid engine we refer to resources by path. Frustrating as that can be sometimes, to me it still seems like the best option. The big problem with GUIDs is that they are non-transparent and unreadable, making it much harder to fix stuff when things go wrong. This also makes file merging harder.

Using a (GUID, path) combination is attractive in some ways, but it also adds a lot of complexity to the system. I *really* don't like adding complexity. I only want to do it when it is absolutely necessary. And the (GUID, path) combination doesn't feel like a perfect solution to me. It would also require us to come up with a new scheme for handling localization and platform specific resources. Currently we do that with extensions on the file name, so a reference to *textures/flowers/rose* may open *textures/flowers/rose.fr.dds* if you are using French localization. If we switched to GUIDs we would have to come up with a new system for this.

We already have a tool (the Dependency Checker) that understands references and can handle renames by patching references. So it seems to me that the best strategy going forward is to keep using paths as references and just add caching of reference information to the tool so that it is quicker to use.

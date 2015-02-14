# Lightweight Lua Bindings

A scripting language, such as Lua, can bring huge productivity gains to a game project. Quick iterations, immediate code reloads and an in-game console with a [read-eval-print-loop](http://en.wikipedia.org/wiki/Read-eval-print_loop) are invaluable tools. A less obvious benefit is that introducing a scripting language creates a clear dividing line between "engine" and "gameplay" code with a well defined API between them. This is often good for the structure of the engine, at least if you intend to use it for more than one game.

The main drawback is of course performance. It is a scary thing to discover late in a project that the game is slow because the script is doing too much. Especially since bad script performance cannot always be traced back to bugs or bad algorithms. Sure, you get those as well, but you can also get problems with "overall slowness" that cannot easily be traced back to specific bottlenecks or hot spots. There are two reasons for this. First, the slowness of script code compared to C, which means that everything just takes more time. And second, the fact that gameplay code tends to be "connection" rather than "compute" heavy which means there is less to gain from algorithmic improvements.

Part of this is a management issue. It is important to monitor the script performance (on the slowest target platform) throughout the production so that measures can be taken early if it looks like it will become a problem. But in this article I will focus on the technical aspects, specifically the C-to-Lua bindings.

It is important to note that when I am talking about performance in this article I mean performance on current generation consoles, because that is where performance problems occur. PC processors are much more powerful (especially when running virtual machines, which tend to be brutal to the cache). The extra cores on the consoles don't help much with script execution (since scripts are connection heavy, they are hard to multithread). *And* the PC can run LuaJIT which [changes the game completely](http://luajit.org/performance_x86.html).

This may of course change in future generation consoles. If anyone from Sony or Microsoft is reading this, please add support for JITting to your next generation ventures.

## Lua bindings

Apart from optimizing the Lua interpreter itself, optimizing the bindings between Lua and C is the best way of achieving a general performance improvement, since the bindings are used whenever Lua calls some function in the C code which in a typical game happens constantly.

The standard way of binding an object on the C side to Lua is to use a *full userdata* object. This is a heap allocated data blob with an associated *metatable* that can be used to store the methods of the object. This allows the user to make a call like:

```cpp
game_world:get_camera():set_position(Vector3(0,0,0))
```

In many ways, this is the easiest and most convenient way of using objects in Lua, but it comes with several performance problems:

* Any time an object is passed from C to Lua, such as the camera in `get_camera()`
or the vector created by `Vector3(0,0,0)`, memory for the object must be allocated on the heap. This can be costly.

* All the heap objects must be garbage collected by Lua. Calls such as `get_camera()` create temporary objects that must be collected at some later time. The more garbage we create, the more time we need to spend in garbage collection.

* Making use of many heap allocated objects can lead to bad cache performance. When the C side wants to use an object from Lua, it must first fetch it from Lua's heap, then (in most cases) extract an object pointer from its data and look up the object in the game heap. So each time there is an extra cache miss.

* The colon method call syntax `world:get_camera()` actually translates to something like (I've simplified this a bit, see the Lua documentation for details) `world._meta_table["get_camera"](world)`. I.e., it creates an extra table lookup operation for every call.

We can get rid of the first two issues by caching the Lua objects. I.e. instead of creating a new Lua object every time `get_camera()` is called, we keep a reference to the object on the Lua side and just look it up and return it every time it is requested. But this has other disadvantages. Managing the cache can be tricky and it creates a lot more objects in the Lua heap, since the heap will now hold every object that has ever been touched by Lua. This makes garbage collection take longer and the heap can grow uncontrollably during the play of a level, depending on which objects the player interacts with. Also, this doesn't solve the issue with objects that are truly temporary, such as `Vector3(0,0,0)`.

A better option is to use what Lua calls *light userdata*. A light userdata is essentially just a C pointer stored in Lua, with no additional information. It lives on the Lua stack (i.e. not the heap), does not require any memory allocations, does not participate in garbage collection and does not have an associated metatable. This addresses all our performance problems, but introduces new (not performance-related) issues:

* Since the objects don't have metatables we cannot use the convenient colon syntax for calling their methods.

* Light user data objects do not carry any type information, they are just raw pointers. So on the C side we have no way of telling if we have been called with an object of the right type.

* Lifetime management is trickier since objects do not have destructors and are not garbage collected. How do we manage dangling pointers in Lua?

## Colon syntax

With light user data we cannot use the colon syntax to look up methods. Instead we must call global functions and pass in the objects as parameters. But we can still make sure to organize our methods nicely, i.e., put all the functions that operate on *World* objects in a table called *World*. It might then look something like this:

```lua
Camera.set_position(World.get_camera(game_world), Vector3(0,0,0))
```

If you are used to the object oriented style this way of writing can feel awkward at first. But in my experience you get accustomed to it quite quickly. It does have some implications which are not purely syntactical though. On the plus side, this style of writing makes it easy to cache the method lookups for better performance:

```lua
local camera_set_position = Camera.set_position
local world_get_camera = World.get_camera

camera_set_position(world_get_camera(game_world), Vector3(0,0,0))
```

This transformation is so simple that you can easily write a script that performs it on your entire code base.

The main drawback is that we are no longer doing dynamic method lookup, we are calling one specific C method. So we can't do virtual inheritance with method overrides. To me that is not a big problem because firstly, I think inheritance is vastly overrated as a design concept, and secondly, if you really need virtual calls you can always do the virtual method resolution on the C side and get the benefits while still having a static call in Lua.

## Type checking

For full userdata we can check the type by looking at the metatable. The Lua library function `luaL_checkudata` provides this service. Since light userdata is just a raw pointer to Lua, no corresponding functionality is offered. So we need to provide the type checking ourselves. But how can we know the type of an arbitrary C pointer?

An important thing to notice is that type checking is only used for debugging. We only need to know if a function has been called with the right arguments or not. So we don't actually need to know the exact type of the pointer, we just need to know if it points to the thing we expect. And since this is only used for bug detection, it doesn't matter if we get a few false positives. And it is fine if the test takes a few cycles since we can strip it from our release builds.

Since we just need to know "is the object of this type" we can make test different for each type. So for each type, we can just pick whatever test fits that type best. Some possibilities are:

* Store a known four byte type marker at the start of the object's memory. To verify the type, just dereference the pointer and check that the first four bytes match the expected marker. (This is the method I use most frequently.)

* Keep a hash table of all objects of the specified type and check if it is there.

* For objects that are allocated from a pool, check that the pointer lies within the range of the pool.

## Object lifetimes

There are two approaches you can take to ownership of objects in the Lua interface. They can either be Lua owned and destroyed by the garbage collector or they can be owned by the C side and destroyed by explicit function calls. Both approaches have their advantages, but I usually lean towards the latter one. To me it feels more natural that Lua explicitly creates and destroys cameras with `World.destroy_camera()` rather than cameras just popping out of existence when the garbage collector feels they are no longer used. Also, since in our engine, Lua is an option, not a requirement, it makes more sense to have the ownership on the C side.

With this approach you have the problem that Lua can hold "dangling pointers" to C objects, which can lead to nasty bugs. (If you took the other approach, you would have the opposite problem, which is equally nasty.)

Again, for debugging purposes, we would want to do something similar to what we did with the type information. We would like to know, in debug builds, if the programmer has passed us a pointer to a dead object, so that we can display an error message rather than exhibit undefined behavior.

This is a trickier issue and I haven't found a clear cut solution, but here are some of the techniques I have used:

* Clear out the marker field of the object when it is freed. That way if you attempt to use it later you will get a type error. Of course, checking this can cause an access violation if the memory has been returned to the system.

* For objects that get created and destroyed a lot, such as particles or sound instances, let Lua manage them by IDs rather than by raw pointers.

* Keep a hash table of all known live objects of the type.

* Let Lua point to the object indirectly through a handle. Use some bits of the pointer to locate the handle and match the rest to a counter in the handle so that you can detect if the handle has been released and repurposed for something else.

## Conclusions


Using light instead of full userdata does make things more inconvenient. But as we have seen, there are tricks that help overcome many of these inconveniences.

We still haven't looked at truly the temporary objects, such as `Vector3(0,0,0)`. In my next article I will discuss what can be done about them.
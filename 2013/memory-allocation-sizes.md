## Garbage Collection and Memory Allocation Sizes

As a performance conscious programmer in a soft-realtime environment I've never been too fond of garbage collection.

Incremental garbage collectors (like the one in Lua) make it tolerable (you get rid of the horrible garbage collection stalls), but there is still something unsettling about it. I keep looking at the garbage collection time in the profiler, and I can't shake the feeling that all that time is wasted, because *it doesn't really do anything*.

Of course that isn't true. Garbage collection frees the programmers from a lot of busywork. And the time they gain can go into optimizing other systems, which leads to a net performance win.

It also simplifies some of the hairy ownership questions that arise when data is transferred between systems. Without garbage collection, those questions must be solved in some other way. Either by reference counting (error-prone) or by making local copies of the data to assume ownership (ugly and costly).

But still, there is that annoying performance hit. 

I was pretty surprised to see that the developers [Go](http://golang.org/), a language that looks well-designed and targets low-level programmers, decided to go with garbage collection rather than manual memory management. It seemed like a strange choice.

But recently I've started to see things differently.

One thing I've noticed as I delve deeper and deeper into data-oriented design is that I tend to allocate memory in much larger chunks than before. It's a natural consequence of trying to keep things continuous in memory, treating resources as large memory blobs and managing arrays of similar objects together.

This has interesting consequences for garbage collection, because when the garbage collector only has to keep track of a small number of large chunks, rather than a large number of small chunks, it can perform a lot better.

Let's look at a simple example in Lua. Say we want to write a class for managing bullets. In the non-data-oriented solution, we allocate each bullet as a separate object:

```lua
function Bullet:update(dt)
    self.position = self.position + self.velocity * dt
end

function Bullets:update(dt)
    for i,bullet in ipairs(self.bullets) do
        bullet:update(dt)
    end
end
```

In the data-oriented solution, we instead use two big arrays to store the position and velocity of *all* the bullets:

```lua
function Bullets:update(dt)
    for i=1,#self.pos do
        self.pos[i] = self.pos[i] + dt * self.vel[i]
    end
end
```

I tested these two solutions with a large number of bullets and got two interesting results:

* The data-oriented solution runs **50 times** faster.
* The data-oriented solution only needs **half** as much time for garbage collection.

That the data-oriented solution runs so much faster shows what cache coherence can do for you. It is also a testament to how awesome LuaJIT is when you give it tight inner loops to work with.

Note that in this test, the *Bullet* code itself did not create any garbage. The speed-up comes from being faster at collecting the garbage created by *other systems*. And the reason for this is simply that with fewer, larger memory allocations, there is less stuff that the garbage collector has to trawl through. If we add in the benefit that the data-oriented solution will create fewer objects and generate less garbage, the benefits will be even greater.

So maybe the real culprit in isn't garbage collection, but rather having many small memory allocations. And having many small memory allocations does not just hurt the garbage collector, it is bad for other reasons as well. It leads to bad cache usage, high overhead in the memory allocator, fragmentation and bad allocator performance. It also makes all kinds of memory problems harder to deal with: memory leaks, dangling pointers, tracking how much memory is used by each system, etc.

So it is not just garbage-collected languages like Lua that would benefit from allocating memory in larger chunks, but manually managed languages like C++ as well.

Recently, I've come to think that the best solution to memory management issues in C++ is to avoid the kitchen-sink global memory allocator as much as possible and instead let each subsystem take a much more hands-on approach to managing its own memory.

What I mean by this is that instead of having the sound system (for example) send lots of memory requests to the kitchen-sink memory manager, it would only request a few large memory blocks. Then, it would be the responsibility of the system to divide that up into smaller, more manageable pieces that it can make practical use of.

This approach has a number of advantages:

* Since the system knows the usage patterns for its data, it can arrange the memory efficiently. A global memory allocator has no such knowledge.

* It becomes much easier to track memory use by system. There will be a relatively small number of global memory allocations, each tagged by system. It becomes obvious how much memory each system is consuming.

* Memory *inside* a system can be easily tracked, since the system knows what the memory *means* and can thus give useful information about it (such as the name of the object that owns it).

* When a system shuts down it can quickly and efficiently free all of its memory.

* Fragmentation problems are reduced.

* It actively encourages good memory behavior. It makes it easier to do good things (achieve cache locality, etc) and harder to do bad things (lots of small memory allocations).

* Buffer overflows will tend to overwrite data within the same system or cause page faults, which will make them easier to find.

* Dangling pointer access will tend to cause page faults, which will make them easier to find.

I'm tempted to go so far as to *only* allow *whole page allocations* on the global level. I.e., a system would only be allowed to request memory from the global manager in chunks of whole system pages. Then it would be up to the system to divide that up into smaller pieces. For example, if we did the bullet example in C++, we might use one such chunk to hold our array of *Bullet* structs.

This has the advantage of completely eliminating external fragmentation. (Since everything is allocated in chunks of whole pages and they can be remapped by the memory manager.) We can still get address space fragmentation, but using a 64-bit address space should take care of that. And with this approach using 64-bit pointers is less expensive, because we have fewer individually allocated memory blocks and thus fewer pointers.

Instead we get internal fragmentation. If we allocate the bullet array as a multiple of the page size (say 4 K), we will on average have 2 K of wasted space at the end of the array (assuming the number of bullets is random).

But internal fragmentation is a *much nicer* problem to deal with than external fragmentation. When we have internal fragmentation, it is one particular system that is having trouble. We can go into that system and do all kinds of things to optimize how its handling memory and solve the problem. With external fragmentation, the problem is *global*. There is no particular system that owns it and no clear way to fix it other than to try lots of things that we hope might "improve" the fragmentation situation.

The same goes for out-of-memory problems. With this approach, it is very clear which system is using too much memory and easy to fix that by reducing the content or doing optimizations to that system.

Dealing with bugs and optimizations on a system-by-system simplifies things enormously. It is quite easy to get a good grasp of everything that happens in a particular system. Grasping everything happens in the entire engine is a superhuman task.

Another nice thing about this approach is that it is quite easy to introduce it on a system-by-system basis. All we have to do is to change one system at a time so that it allocates its memory using the page allocator, rather than the kitchen-sink allocator. 

And if we have some messy systems left that are too hard to convert to this approach we can just let them keep using the kitchen-sink allocator. Or, even better, we can give them their own private heaps in memory that they allocate from the page allocator. Then they can make whatever mess they want there, without disturbing the other systems.

# Multithreaded Gameplay

I've written [before](http://bitsquid.blogspot.se/2009/10/multithreaded-gameplay.html) about multithreading gameplay, but since I didn't really come to any conclusion I think it is time to revisit the topic.

As the number of processors and cores in consumer hardware keeps increasing, [Amdahl's law](http://en.wikipedia.org/wiki/Amdahl's_law) tells us that any single-threaded part of the code will have a bigger and bigger effect on the performance. (As long as you are not memory bound, so keep those caches happy, ok?)

So even if single-threaded gameplay isn't a problem today it soon will be. At some point the elephant will outgrow the living room.

There are (at least) three problems with multithreading gameplay code as we know it:

1. Writing and reading multithreaded code is much harder than single threaded code, especially for "messy" stuff such as gameplay code.

2. Gameplay code tend to be more sprawling than engine code, touching all kinds of systems, which means that the standard optimisation technique of finding the hotspots and multithreading them is less likely to work.

3. Lua, which we use as our scripting language, does not have built-in multithreading support. This might not be a problem for you. On the other hand, if you expect your gameplay programmers to write multithreaded C++ code, you probably have other problems.

If we start with the first point, I don't think it is reasonable to expect gameplay programmers to write safe and efficient multithreaded code using the standard techniques of mutexes, locks, queues, semaphores, atomic operations, etc. Especially not when writing messy gameplay code where requirements often change and experimentation and quick iterations are important. If anyone has experience of this, I'd like to know.

So I think the primary goal is to find a multithreading model that is *easy* to work with.

To me, the best (easiest and safest) model seems to be the [Actor model](http://en.wikipedia.org/wiki/Actor_model) used for example by [Erlang](http://en.wikipedia.org/wiki/Erlang_(programming_language)) and [Scala](http://en.wikipedia.org/wiki/Scala_(programming_language)).

You can read up on the actor model if you are not familiar with it. The basic idea is that processing nodes only touch their own local memory and communicate with other nodes through asynchronous message passing. Since there is no shared memory, explicit synchronization primitives are not necessary.

Luckily for us, using this model also takes care of issue #3. If the nodes don't need to share memory, we can let them live in separate Lua VMs that communicate through message passing. Typically we would spawn a separate Lua VM for each processing core in our system.

As a completely contrived example, suppose we had a bunch of numbers that we needed to factor. We could then split them up by our number of VMs and send each VM a message [`'factor'`, *n*]. Each VM would compute its factors in parallel and send the result back to the main thread.

All fine and dandy. This would work well and give us a good performance boost. But of course, this contrived example is *absolutely nothing like* real gameplay code.

In real gameplay code, we don't have pockets of completely isolated but computationally intensive code that lends itself to easy parallelization. (If we do, that code should probably be moved *out of* the gameplay code and *into* the engine.)

Instead, most gameplay code interacts with the world and does things like moving a unit a little bit, casting a physics ray, adjusting the position of another unit, etc. Unless we can paralelize that kind of *messy* code, we won't have gained very much.

The problem here is that your engine is probably a big ball of mutable state. If it isn't, congratulations to you I guess. You have figured out something we others haven't and I look forward to your next GDC talk. But for the sake of argument, let's assume that it is.

Any interaction with this mutable state (say a script calling `PhysicsWorld.raycast()`) is a potential for threading issues.

We *could* try to make the entire script API thread-safe. For example, we could put a critical section in each API call. But that is unlikely to make anyone happy. With so many critical sections, we will probably loose whatever performance we hoped to gain from multithreading.

So we seem to be at an impasse. Gameplay code will need to interact frequently with a lot of engine APIs and making those APIs thread-safe will likely kill performance.

I've been stuck here for a while. To be honest, a couple of years. (Hey, it's not like I haven't had other stuff to do.) But in the general creative atmosphere of GDC and a discussion with some colleagues and the nice people at [Pixeldiet](http://pixeldiet.se), something shook loose.

Instead of synchronizing at each function call, what if we did it at the level of the API:

```lua
Unit = LuaThreads.lock_api("Unit", player, LockType.WRITE)
...
Unit.set_position(0, Vector3(0,0,0))
# Do other stuff with the player
...
LuaThreads.unlock_api(Unit)
```

In this model, the Lua VM for the threads start with a blank slate. There are no public APIs (except for safe, functional APIs that don't touch mutable state). To do anything with the engine, you must obtain a lock for a particular API.

You could argue that this is nothing than another shade of the complicated explicit multithreading model that we wanted to get rid of to begin with, but I do think there is something different here.

First, since the Lua part of the code will use the Actor model, we have eliminated all the problems with synchronizing the Lua state.

Second, since you can't use an API before locking in it there is a safety mechanism that prevents you from accidentally using multithreading the wrong way.

In this model, the main Lua thread (yes there would still be a *main* Lua thread) would spawn of a number of jobs for performing a computation intensive task, such as updating a number of units. The main Lua thread would be suspended while the task was performed. (We can only avoid suspension if the main thread also uses the locking mechanism to access the APIs, but that seems too cumbersome.)

The worker Lua threads lock the APIs they need to perform their tasks, and when they have completed the control returns back to the main Lua thread that can gather the results.

Since Lua supports [coroutines](http://en.wikipedia.org/wiki/Coroutine) (aka green threads) the `lock_api()` function does not have to lock the thread if an API is locked by someone else, we can just switch to a different coroutine.

This model is certainly not perfect. It's a bit annoying that we still have to have a main Lua thread that is "special". It's also a pity that the main Lua thread can't continue to run while the jobs are being executed, since that could allow for greater parallelism.

And it is certainly possible for the gameplay programmer to mess up. For example, it is easy to create a deadlock by requiring the same APIs in different orders in different threads.

But still, to me this seems like the best solution, and something that would actually be worthwhile for the gameplay programmers (unlike some of my previous ideas). So I think I will start tinkering with it and see if it will fly.

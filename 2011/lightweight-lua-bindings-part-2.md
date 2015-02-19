# Lightweight Lua Bindings -- Part 2

In my last article I showed how you could create lightweight and garbage collection friendly Lua bindings by using raw C pointers stored as *light user data*. Unfortunately, this approach doesn't work for temporary objects, because if the objects don't have permanent life on the C side, there is nothing for the raw pointers to point to.

By far the most common source of temporary objects are mathematical computations involving vector3s and quaternions, such as:

```lua
local p = Camera.get_position(cam) + velocity*dt
```

Here, temporary vector3s are generated as intermediate results in each step of the computation.

Note that computations with simple floats are not a problem, because they live on the stack rather than on the heap. They are passed by value and do not require garbage collection. It is only computations with bigger objects: vector3s, quaternions and matrices that cause us trouble.

The best thing would be if we could tell Lua to treat vector3s just as floats, allocate them on the stack and pass them by value. Unfortunately, Lua does not allow that. Only the built-in types (nil, bool, number, light user data) have value semantics. All other objects are references, heap allocated and garbage collected. (Note though, that there *are* garbage collected languages that support complex types with value semantics. For example, in C# you can create your own value types by using the *struct* keyword.)

If you are willing to modify Lua you can extend its value type and make room for vector3s. Just add a *Vector3* to the *Value* union in *object.h* and a corresponding new Lua type *LUA_TVECTOR3*. However, note that this will significantly increase the memory used by Lua, since the *Value* union is used everywhere, so it's not something that I would recommend.

Two other techniques commonly used by garbage collected languages are *escape analysis* and *generational garbage collection*. With escape analysis the compiler tries to detect which objects can escape the current scope. If the compiler can detect that an object is truly temporary and doesn't leave the scope, it can convert the heap allocation to a stack allocation. Generational garbage collection means that the garbage collector spends more time looking at newly created objects. This means that it's less bad to create a lot of temporary garbage, because it will probably be cleaned up pretty quickly. It's still not *good* though. And both approaches are a bit scary in that you are putting your fate completely in the hands of the compiler.

Lua has no escape analysis. There is an experimental generational garbage collector in Lua 5.2. 

An unconventional approach that is possible in Lua is to represent a vector3, not as a compound object, but as three individual float values on the stack. This is possible since Lua allows functions to return multiple values:

```lua
local cx, cy, cz = Camera.get_position(cam)
local px, py, pz = Vector3.add(cx, cy, cz, Vector3.multiply(vx, vy, vz, t))
```

Possible, and completely garbage free, but tedious and hard to read. I wouldn't want to write a lot of code in this way. But it is a technique that can be good to remember if you want to trim your garbage. For example, if you write a Lua function that takes a rect, write it so that it takes *(x,y,w,h)* rather than *({x,y,w,h})* and your callers will generate a lot less garbage.

So, having exhausted all other possibilities, we are back where we started. We have to store the vector3s as user data. But we don't want to be constantly creating and destroying them on the heap. So what can we do? We recycle them!

Instead of allocating new vector3s every time, we keep a pool of them around for use as temporary objects. And whenever we need a new one, we just get it from the pool.

Note that this approach works with both heavy and light user data. With heavy user data, the pool is a Lua table of heavy user data vector3s. With light user data, the pool is a permanent buffer on the C side and we represent vector3s as light user data pointers into that buffer. Either approach is possible, but the light user data approach has better performance. We can pack the data more tightly, and the Lua garbage collector doesn't have to sweep the objects.

There is one final part of the puzzle and that is how we recycle the vector3s. When we generate a vector3 we don't know where the user might store it and how long it might be in use. When is it safe to reuse a slot in the pool for a new vector3?

The ideal thing would be if we could detect exactly which vector3s Lua was using, so that we could recycle only those vector3s not currently in use. But if you think about it, that is exactly the garbage collection problem. And garbage collection was what we were trying to get away from! We don't want to replace one kind of garbage collection with another. We need something more efficient.

There are a lot of approaches you could take to recycling. For example, you could ask the user to mark in various ways which objects can and cannot be recycled. Since this system is already quite complex, and hard to understand for gameplay programmers I've decided to go with the simplest possible rule:

Each frame flip all of the vector3s in Lua are recycled.

I call this "The Great Death". This means that you can do whatever you like with the vector3s in the current frame: add them, multiply them, etc. They will work just as vector3s in C++ and they won't require garbage collection. But you can't save them in a variable and use them the next frame. If you want to do that you will have to "box" them, like this:

```lua
self.box = Vector3Box()
...
self.box:store(Camera.get_position(cam) + t*velocity)
```

A Vector3Box is a heap allocated heavy user data object that stores a vector3. You can extract it in some later frame by calling *self.box:retreive()*. This gives you back a temporary vector3 valid for the current frame, that you can use for more computations. Since *Vector3Box()* allocates memory you want to minimize those calls. Create your boxes up front as member variables and then use *store()* and *retrieve()* to set and get data.

## The implementation

Now that we have all the pieces in place, let's see what the actual implementation looks like. At the C side we have a buffer that holds all our temporary vector3s.

```lua
const int LUA_VECTOR3_BUFFER_SIZE = 4096;
Vector3 lua_vector3_buffer[LUA_VECTOR3_BUFFER_SIZE];
unsigned used_lua_vector3s = 0;
```

This buffer is statically allocated, so we can check if a light user data is a vector3 by checking if the pointer lies within the buffer's range.

Whenever we need to return a new vector3 from a function in the Lua interface we just return *lua_vector3_buffer[used_lua_vector3s++]* (we check that the buffer doesn't overflow) and each frame we reset *used_lua_vector3s = 0*.

It is nice to be able to use mathematical operators such as *, +, - etc on vector3s. Lua doesn't allow light user data objects to have individual meta tables, *but* we can set one common meta table for all light user data objects. So we can get *, + and - for vector3s by putting them in that table.

If you want mathematical operators for other types, such as quaternions and matrices, you have to write the *__mul__* function in the meta table so that it checks the objects' types and calls the right function. I don't bother, because in my experience, it is only the operators for vector3 that really matter in terms of making the scripts readable. For the other classes I just use the functional style *Matrix4x4.multiply(m1, m2)*.

From the perspective of the gameplay programmer there are two drawbacks with this solution. The first is that if you use too many temporary vector3s in one frame you will overflow the buffer and assert. The second is that if you mess up and store a vector3 in a variable and use it in a later frame when it has been recycled for some other purpose, the variable will have silently "mutated" under your feet. A really confusing and hard-to-debug experience.

The first issue can be solved by giving the gameplay programmer some control over the *used_lua_vector3s* variable. So if she knows that if she is going to do a bunch of computations in a scope and that no vector3 will escape that scope, she can manually save and restore the variable:

```lua
local c = Script.used_lua_vector3s()
for i=1,1000 do
	Script.set_used_lua_vector3s(c)
	local t = 2*math.pi*i/500
	local pos = Vector3(math.cos(t), math.sin(t), 0)
	Unit.set_position(unit[i], pos)
end
```

To address the issue of using stale vector3s, note that all vector3 pointers are 12-byte aligned with respect to the start of the vector3 buffer. This means that we can store an arbitrary number 0--11 in the lower bits of the pointer and just mask it out when we access the vector3. So every frame, we can generate a random number in the range 0--11 and store that in the pointer to all vector3s that we create that frame. When a vector3 is passed to us from Lua, we check that its stored number matches the current random number. This means that every time a stale vector3 is used, we have an 11/12 chance of detecting that. Over time, QA and programmers should be able to detect all bad uses of stale vector3s and convert them to proper "boxed" values.

Of course, we only run this test in development builds, in release mode we can skip all this.

So there you have it. While this solution has its quirks it shows a perfectly workable way of doing decent performance vector3 calculations in Lua without involving the garbage collector.

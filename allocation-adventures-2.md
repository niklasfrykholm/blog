# Allocation Adventures 2: Arrays of Arrays

[Last week's post](TODO) ended with a puzzle: How can we allocate an array of dynamically growing and shrinking things in an efficient and data-oriented way? I.e. using contiguous memory buffers and as few allocations as possible.

The example in that post was kind of complicated, and I don't want to get lost in the details, so let's look at a simpler version of the same fundamental problem.

Suppose we want to create a `TagComponent` that allows us to store a number of `unsigned` *tags* for an entity.

These *tags* will be hashes of strings such as `"player"`, `"enemy"`, `"consumable"`, `"container"`, etc and the `TagComponent` will have some sort of efficient lookup structure that allows us to quickly find all entities with a particular tag.

But to keep things simple, let's ignore that for now. For now we will just consider how to store these lists of tags for all our entities. I.e. we want to find an alternative to:

```cpp
std::vector< std::vector<unsigned> > data;
```

that doesn't store every list in a separate memory allocation.

## Fixed size

If we can get away with it, we can get rid of the "array of arrays" by setting a hard limit on the number of items we can store per entity. In that case, the data structure becomes simply:

```cpp
enum {MAX_TAGS = 8};
struct Tags
{
	unsigned n;
	unsigned tags[MAX_TAGS];
};
Array<Tags> data;
```

Now all the data is contained in a single buffer, the data buffer for `Array<Tags>`.

Sometimes the hard limit is inherent in the problem itself. For example, in a 2D grid a cell can have at most four neighbors.

Sometimes the limit is a widely accepted compromise between cost and quality. For example, when skinning meshes it is usually consider ok to limit the number of bone influences per vertex to four.

Sometimes there is no such limit that makes sense inherent in the problem itself, but for the particular project that we are working on we can agree to a limit and design the game with that limit in mind. For example we may know that there will never be more than two players, never more than three lights affecting an object, never more than four tags needed for an entity, etc.

This of course requires that we are writing, or at least configuring, the engine for a particular project. If we are writing a general engine to be used for a lot of games that may be very different it is hard to set such limits without artificially constraining what those games will be able to do.

Also, since the fixed size must be set to the maximum array size, every entity that uses fewer entries than the maximum will waste some space. If we need a high maximum this can be a significant problem and it might make sense to go with a dynamic solution even though there is an upper limit.

So while the fixed size approach can be good in some circumstances, it doesn't work in every situation.

## Linked list

Instead of using arrays, we can put the tags for a particular entity in a linked list:

```cpp
struct Tag
{
	unsigned tag;
	Tag *next;
};
Array<Tag *> data;
```

Using a linked list may seem like a very bad choice at first. A linked list can give us a cache miss for every `next` pointer we follow. This would give us even worse performance than we would get with `vector< vector<unsigned> >`.

But the nodes in the linked list do not necessarily have to be allocated individually on the heap. We can do something similar to what we did in the last post, allocate the nodes in a buffer and refer to them using offsets rather than pointers:

```cpp
struct Node
{
	unsigned tag;
	unsigned next;
};
Array<Node> nodes;
```

With this approach we only have a single allocation -- the buffer for the array that contains all the tag nodes -- and we can follow the indexes in the `next` field to walk the list.

**Side note:** Previously I have always used `UINT_MAX` to mark an *nil* value for an `unsigned`. So in the struct above, I would have used `UINT_MAX` for the `next` value to indicate the end of the list. But recently, I've start to switch to using `0` instead. I think it is nice to be able to `memset()` a buffer to `0` to reset all values. I think it is nice that I can just use `if (next)` to check if the value is valid. It is also nice that the invalid value will continue to be `0` even if I decide to change the type to `int` or `uint_16t`. It does mean that I can't use the `nodes[0]` entry, since that is reserved for the `nil` value, but I think the increased simplicity is worth it.

Using a single buffer rather than separate allocations gives us much better cache locality, but the `next` references can still jump around randomly in that buffer. So when following the next references, we can still get cache misses. If the buffer is large, this can be as bad as using freely allocated nodes. 

Another thing to note is that we are wasting a significant amount of memory. Only half of the memory is used for storing tags, the rest of it is wasted on the `next` pointers.

We can try to address both these problems by making the nodes a little bigger:

```cpp
enum {MAX_TAGS_PER_NODE = 8};
struct Node
{
	unsigned n;
	unsigned tags[MAX_TAGS_PER_NODE];
	unsigned next;
};
Array<Node> nodes;
```

This is just as before, except we have more than one tag per node. This gives better cache performance because we can now process eight tags at a time before we have to follow a next pointer and jump to a different memory location. Memory use could also be better. If the nodes are full, we are using 80 % of the memory for actual tags, rather than 50 % as we had before.

However, if the nodes are *not* full we could be wasting even more memory than before. If entities have three tags on average, then we are only using 30 % of the memory to store tags.

We can balance cache performance and memory use by changing `MAX_TAGS_PER_NODE`. Increasing it gives better cache coherence, because we can process more tags before we need to jump to a different memory location. However, increasing it also means more wasted memory. It is probably good to set the size so that "most entities" fit into a single node, but a few special ones (players and enemies maybe) need more.

One interesting thing to note about the cache misses is that we could get rid of them by sorting the nodes. If we sort them so that the nodes in the same next chain always appear directly after one another in the array, then walking the list will access the data linearly in memory, just as if we were accessing an array.

```
--------------------------------------------------
|  A1 --|--> A2 --|--> A3 |  B  |  C1 --|--> C2  |
--------------------------------------------------
```

Note that a complete ordering is not required, it is enough if the linked nodes end up together. Single nodes, such as the `B` node above could go anywhere.

Since these are dynamic lists where items will be added and removed all the time, we can't really do a full `O(n log n)` sort every time something changes. That would be too expensive. But we could sort the list "incrementally". Every time the list is accessed, we do a little bit of sorting work. As long as the rate of mutation is low compared to the rate of access, which you would expect in most circumstances, our sorting should be able to keep up with the mutations and keep the list "mostly sorted".

You would need a sorting algorithm that can be run incrementally and that works well with already sorted data. Two-way bubble sort perhaps? I haven't thought too deeply about this, because this is not the method I decided to use in the end.

## Custom memory allocator

Another option is to write a custom memory allocator to divide the bigger buffer up into smaller parts for memory allocations.

You might think that this is a much too complex solution, but a custom memory allocator doesn't necessarily need to be a complex thing. In fact, both the *fixed size* and *linked list* approaches described above could be said to be using a very simple kind of custom memory allocator: one that just allocates fixed blocks from an array. Such an allocator does not need many lines of code.

Another criticism against this approach is that if we are writing our own custom memory allocator, aren't we just duplicating the work that `malloc()` or `new` already does? What's the point of first complaining a lot about how problematic the use of `malloc()` can be and then go on to write our very own (and probably worse) implementation of `malloc()`?

The answer is that `malloc()` is a generic allocator that has to do well in a lot of different situations. If we have more detailed knowledge of how the allocator is used, we can write an allocator that is both simpler and performs better. For example, as seen above, when we know the allocations are fixed size we can make a very fast and simple allocator. System software typically uses such allocators (check out the [slab allocator](TODO) for instance) rather than relying on `malloc()`.

In addition, we also get the benefit that I talked about in the previous post. Having all of a system's allocations in a single place (rather than mixed up with all other `malloc()` allocations) makes it much easier to reason about them and optimize them.

As I said above, the key to making something better than `malloc()` is to make use of the specific knowledge we have about the allocation patterns of our system. So what is special about our `vector < vector < unsigned > >` case?

**There are no external pointers to the data.**

All the pointers are managed by the `TagComponent` itself and never visible outside that component.

This means that we can "move around" memory blocks as we like, as long as the `TagComponent` keeps track of and updates its data structures with the new locations. So we don't have to worry (that much) about fragmentation, because when we need to, we can always move things around in order to defrag the memory.

I'm sure you can build something interesting based on that, but I actually want to explore another property:

**Memory use always grows by a power of two.**

If you look at the implementation of `std::vector` or a similar class (since STL code tends to be pretty unreadable) you will see that the memory allocated always grows by a factor of two. (Some implementations may use 1.5 or something else, but usually it is 2. The exact figure doesn't matter that much.)

The `vector` class keeps track of two counters: 

* `size` which stores the number of items in the `vector` and 
* `capacity` which stores how many items the `vector` has *room for*, i.e. how much memory has been allocated.

If you try to push an item when `size == capacity`, more memory is needed. So what typically happens is that the `vector` allocates twice as much memory as was previously used (`capacity *= 2`) and then you can continue to push items.

This post is already getting pretty long, but if you haven't thought about it before you may wonder why the `vector` grows like this. Why doesn't it grow by one item at a time, or perhaps 16 items at a time.

The reason is that we want `push_back()` to be a cheap operation, O(1) using computational complexity notation. When we reallocate the vector buffer, we have to move all the existing elements from the old place to the new place. This will take O(n) time. Here, *n* is the number of elements in the vector.

If we allocate one item at a time, then we need to allocate every time we push and since re-allocate takes O(n) that means push will also take O(n). Not good.

If we allocate 16 items at a time, then we need to allocate every 16th time we push, which means that push on average takes O(n)/16, which by the great laws of O(n) notation is still O(n). Oops.

But if we allocate 2*n items when we allocate, then we only need to reallocate after we have pushed *n* more items, which means that push on average takes O(n)/n. And O(n)/n is O(1), which is exactly what we wanted.

Note that it is just *on average* that push is O(1). Every *n* pushes, you will encounter a push that takes O(n) time. If you have really big vectors, that can cause an unacceptable hitch and in that case you may want to use something other than a `vector` to store the data.

Anyways, back to our regular programming.

The fact that our data (and indeed, any kind of dynamic data that uses the `vector` storage model) grows by powers of two is actually really interesting. Because it just so happens that there is an allocator that is very good at allocating blocks at sizes that are powers of two. It is called the [buddy allocator](TODO) and we will take a deeper look at it in the next post.
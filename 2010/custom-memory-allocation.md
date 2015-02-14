# Custom Memory Allocation in C++

For console development, memory is a very precious resource. You want good locality of reference and as little fragmentation of possible. You also want to be able to track the amount of memory used by different subsystems and eliminate memory leaks. To do that, you want to write your own custom memory allocators. But the standard ways of doing that in C++ leave a lot to be desired.

You can override global new and replace it with something else. This way you can get some basic memory tracking, but you still have to use the same allocation strategy for all allocations, which is far from ideal. Some systems work better with memory pools. Some can use simple frame allocation (i.e., pointer bump allocation).  You really want each system to be able to have its own custom allocators.

The other option in C++ is to override new on a per class basis. This has always has seemed kind of strange to me. Pretty much the only thing you can use it for are object pools. Global, per-class object pools. If you want one pool per thread, or one pool per streaming chunk -- you run into problems.

Then you have the STL solution, where containers are templated on their allocator, so containers that use different allocators have different types. It also has fun things such as *rebind()*. But the weirdest thing is that all instances of the allocator class must be equivalent. So you must put all your data in static variables. And if you want to create two separate memory pools you have to have two different allocator classes.

I must admit that every time I run into something in STL that seems completely bonkers I secretly suspect that I have missed something. Because obviously STL has been created by some really clever people who have thought long and hard about these things. But I just don't understand the idea behind the design of the custom allocator interface at all. Can any one explain it to me? Does any one use it? Find it practical? Sane?

If it weren't for the allocator interface I could almost use STL. Almost. There is also the pretty inefficient *map* implementation. And the fact that *deque* is not a simple ring buffer, but some horrible beast. And that many containers allocate memory even if they are empty... So my own version of everything it is. Boring, but what's a poor gal gonna do?

Back to allocators. In conclusion, all the standard C++ ways of implementing custom allocators are (to me) strange and strangely useless. So what do I do instead? I use an abstract allocator interface and implement it with a bunch of concrete classes that allocate  memory in different ways:

```cpp
class Allocator
{
public:
    virtual void *allocate(size_t size, size_t align) = 0;
    virtual void deallocate(void *p) = 0;
    virtual size_t allocated_size(void *p) = 0;
}
```

I think this is about as sane as an allocator API can get. One possible point of contention is the *allocated_size()* method. Some allocators (e.g., the frame allocator) do not automatically know the sizes of their individual allocations, and would have to use extra memory to store them. However, being able to answer questions about allocation sizes is very useful for memory tracking, so I require all allocators to provide that information, even if it means that a frame allocator will have to use a little extra memory to store it.

I use an abstract interface with virtual functions, because I don't want to template my classes on the allocator type. I like my allocators to be actual objects that I can create more than one of, thank you very much. Memory allocation is expensive anyway, so I don't care about the cost of a virtual function call.

In the BitSquid engine, you can only allocate memory through an *Allocator* object. If you call *malloc* or *new* the engine will *assert(false)*.

Also, in the BitSquid engine all allocators keep track of the total number of allocations they have made, and the total size of those allocations. The numbers are decreased on *deallocate()*. In the allocator destructor we *assert(_size == 0 && _allocations == 0)* and when we shut down the application we tear down all allocators properly. So we know that we don't have any memory leaks in the engine. At least not along any code path that has ever been run.

Since everything must be allocated through an *Allocator*, all our collection classes (and a bunch of other low-level classes) take an *Allocator &* in the constructor and use that for all their allocations. Higher level classes either create their own allocator or use one of the globals, such as *memory_globals::default_allocator()*.

With this interface set, we can implement a number of different allocators. A *HeapAllocator* that allocates from a heap. A *PoolAllocator* that uses an object pool. A *FrameAllocator* that pointer bumps. A *PageAllocator* that allocates raw virtual memory. And so on.

Most of the allocators are set up to use a backing allocator to allocate large chunks of memory which they then chop up into smaller pieces. The backing allocator is also an *Allocator*. So a pool allocator could use either the heap or the virtual memory to back up its allocations.

We use proxy allocators for memory tracking. For example, the sound system uses:

```cpp
ProxyAllocator("sound", memory_globals::default_allocator());
```

which forwards all allocations to the default allocator, but keeps track of how much memory has been allocated by the sound system, so that we can display it in nice memory overviews.

If we have a hairy memory leak in some system, we can add a *TraceAllocator*, another proxy allocator which records a stack trace for each allocation. Though, truth be told, we haven't actually had to use that much. Since our *assert* triggers as soon as a memory leak is introduced, and the *ProxyAllocator* tells us in which subsystem the leak occurred, we usually find them quickly.

To create and destroy objects using our allocators, we have to use *placement new* and friends:

```cpp
void *memory = allocator.allocate( sizeof(MyClass), alignof(MyClass) );
MyClass *m = new (memory) MyClass(10);

if (m) {
    m->~MyClass();
    allocator.deallocate(m);
}
```

My eyes! The pain! You certainly don't want to type or read that a lot. Thanks C++ for making my code so pretty. I've tried to make it less hurtful with some template functions in the allocator class:

```cpp
class Allocator
{
    template <class T, class P1> T *make_new(const P1 &p1) {return new (allocate(sizeof(T), alignof(T))) T(p1);}

    template <class T> void make_delete(T *p) {
        if (p) {
            p->~T();
            deallocate(p);
        }
    }
```

Add a bunch of other templates for constructors that take a different number of arguments that can be const or non-const and now you can at least write:

```cpp
MyClass *m = allocator.make_new<MyClass>(10);

allocator.make_delete(m);
```

That's not too bad.

One last interesting thing to talk about. Since we use the allocators to assert on memory leaks, we really want to make sure that we set them up and tear them down in a correct, deterministic order. Since we are not allowed to allocate anything without using allocators, this raises an interesting chicken-and-egg problem: who allocates the allocators? How does the first allocator get allocated?

The first allocator could be *static*, but I want deterministic creation and destruction. I don't want the allocator to be destroyed by some random *_exit()* callback god knows when.

The solution -- use a chunk of raw memory and *new* the first allocator into that:

```cpp
char _buffer[BUFFER_SIZE];

HeapAllocator *_static_heap = 0;
PageAllocator *_page_allocator = 0;
HeapAllocator *_heap_allocator = 0;

void init()
{
    _static_heap = new (_buffer)
        HeapAllocator(NULL, _buffer + sizeof(HeapAllocator), BUFFER_SIZE - sizeof(HeapAllocator));
           
    _page_allocator = _static_heap->make_new<PageAllocator>("page_allocator");
    _heap_allocator = _static_heap->make_new<HeapAllocator>("heap_allocator", *_page_allocator);
    ...
}

void shutdown()
{
    ...
    _static_heap->make_delete(_heap_allocator);
    _heap_allocator = 0;
   
    _static_heap->make_delete(_page_allocator);
    _page_allocator = 0;
   
    _static_heap->~HeapAllocator();
    _static_heap = 0;
}
```

Note how this works. *_buffer* is initialized statically, but since that doesn't call any constructors or destructors, we are fine with that. Then we placement new a *HeapAllocator* at the start of that buffer. That heap allocator is a static heap allocator that uses a predefined memory block to create its heap in. And the memory block that it uses is the rest of the *_buffer* -- whatever remains after *_static_heap* has been placed in the beginning.

Now we have our bootstrap allocator, and we can go on creating all the other allocators, using the bootstrap allocator to create them.
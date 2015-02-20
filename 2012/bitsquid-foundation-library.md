# Bitsquid Foundation Library

Today I want to talk a bit about the [Bitsquid Foundation Library](https://bitbucket.org/bitsquid/foundation/overview) that we recently released on Bitbucket (under the permissive MIT license).

It's a minimalistic "foundation" library with things like memory management and collection classes. The idea is to have something that can be used as a reasonable starting-off point for other open source projects.

The library makes some interesting design choices that touches on topics that I have already talked about in this blog and that I think are worth elaborating on a bit further. It also serves an example on how these techniques can be used in "real world" code.

## Separation of data and code

The foundation library implements the idea of separating data definitions and function implementation, that I talked about in [this article](http://www.altdevblogaday.com/2012/09/03/a-new-way-of-organizing-header-files/).

Data is stored in structs with public members (prefixed with an underscore to indicate that you should not mess with them unless you know what you are doing) that are found in **_types.h* files. Functions that operate on the data are written outside of the struct, in separate **.h* files (and organized into namespaces).

For example, the data definition for the dynamic *Array<T>* class is found in *collection_types.h:*

```cpp
template<typename T> struct Array
{
    Array(Allocator &a);
    ~Array();
    Array(const Array &other);
    Array &operator=(const Array &other);
    
    T &operator[](uint32_t i);
    const T &operator[](uint32_t i) const;

    Allocator *_allocator;
    uint32_t _size;
    uint32_t _capacity;
    T *_data;
};
```

The struct contains only the data used by the array and the operators which C++ forces us to implement as member functions.

The implementation of these functions, as well as the declaration and definition of all other functions that operate on the arrays are found in the *array.h* file. It contains things like:

```cpp
namespace array
{
    template<typename T>
    inline uint32_t size(const Array<T> &a)
    {return a._size;}
    
    template<typename T>
    inline bool any(const Array<T> &a)
    {return a._size != 0;}
    
    template<typename T>
    inline bool empty(const Array<T> &a)
    {return a._size == 0;}
}

template <typename T>
inline Array<T>::Array(Allocator &allocator) :
    _allocator(allocator), _size(0), _capacity(0), _data(0)
{}
```

This way of arranging data and code fills two purposes.

First, it improves compile times by reducing header inclusion. Header files that want to make use of arrays only need to include *collection_types.h*, which just contains a few struct definitions. They don't have to drag in *array.h*, with all its inline code.

Headers including other headers indiscriminately because they need their types is what leads to exploding compile times. By only including the minimal thing we need (the type definitions), compile times are minimized.

Second, and more importantly, this design allows the collection types to be freely extended. Is there anything you miss in the *array* interface? Perhaps you would like *shift()* and *unshift()* methods? Or *binary_search()?*

No problem. If you want them you can just add them, and you don't even need to modify *array.h*. Just create your own file *array_extensions.h* or whatever, and add some new functions to the *array* namespace, that manipulate the data in the *Array<T>* interface. The functions you create will be just as good as the functions I have created.

Note that this isn't true for traditional class designs, where you have first-class citizens (methods) and second-class citizens (external functions).

The foundation library has some interesting examples of this. For example, the *string_stream* functions don't operate on any special *StringStream* class, they just directly use an *Array<char>*. Also, the *hash* and *multi_hash* interfaces both work on the same underlying *Hash<T>* struct.

I believe that this design leads to simpler, more orthogonal code that is easier to extend and reuse.

## Memory management

The library implements the allocator system mentioned in [this article](http://bitsquid.blogspot.se/2010/09/custom-memory-allocation-in-c.html). There is an abstract *Allocator* interface, and implementations of that interface can provide different allocation strategies (e.g. ArenaAllocator, HeapAllocator, SlotAllocator, etc).

Since I want to keep the library platform independent, I haven't implemented a *PageAllocator*. Instead, the *MallocAllocator* is used as the lowest allocator level. If you want to, you can easily add a *PageAllocator* for your target platform.

For the same reason, I haven't added any critical section locking to the allocators, so they aren't thread safe. (I'm thinking about adding an interface for that though, so that you can plug in a critical section implementation if needed.)

The system for temporary allocations is kind of interesting and deserves a bit further explanation.

Most games have a need for temporary memory. For example, you might need some temporary memory to hold the result of a computation until it is done, or to allow a function to return an array of results.

Allocating such memory using the ordinary allocation system (i.e., malloc) puts a lot of unnecessary stress on the allocators. It can also create fragmentation, when long lived allocations that need to stay resident in memory are mixed with short lived temporary allocations.

The foundation library has two allocators for dealing with such temporary allocations, the *ScratchAllocator* and the *TempAllocator*.

The *ScratchAllocator* services allocation requests using a fixed size ring buffer. An *allocate* pointer advances through the buffer as memory is allocated, and a corresponding *free* pointer advances as memory is freed. Memory can thus be allocated and deallocated with simple pointer arithmetic. No calls need to be made to the underlying memory management system.

If the scratch buffer is exhausted (the *allocate* pointer wraps around and catches up with the *free* pointer), the *ScratchAllocator* will revert to using the ordinary *MallocAllocator* to service requests. So it won't crash or run out of memory. But it will run slower, so try to avoid this by making sure that your scratch buffer is large enough.

If you forget to free something allocated with the *ScratchAllocator*, or if you accidentally mix in a long-lived allocation among the short-lived ones, that allocation will block the *free* pointer from advancing, which will eventually exhaust your scratch buffer, so keep an eye out for such situations.

*TempAllocator<BYTES>* is a scoped allocator that automatically frees all its allocated memory when it is destroyed (meaning you don't have to explicitly call *deallocate()*, you can just let the allocator fall out of scope). This means you can use it everywhere where you need a little extra memory in a function scope:

```cpp
void test()
{
     TempAllocator1024 ta;
     Array<char> message(ta);
     ...
}
```

The *BYTES* argument to *TempAllocator<BYTES>* specifies how much stack space the allocator should reserve. The *TempAllocator* contains *char buffer[BYTES]* that gets allocated on the stack together with the *TempAllocator*.

Allocation requests are first serviced from the stack buffer, then (if the stack buffer is exhausted) from the *ScratchAllocator*.

This means that *TempAllocator* gives you an allocator that can be used by all collection classes and will use the fastest allocation method possible (local stack memory, followed by scratch buffer memory, followed by malloc() if all else fails).

### Minimalistic collection types

The collection classes in the library are distinctly anti-STL. Some of the important differences:

* They use the allocation system described above (taking an *Allocator* as argument to the constructor). They can thus be used sensibly with different allocators (unlike STL types).

* The use the data/function separation also described above, which means that the headers are cheap to include, and that you can extend them with your own functionality.

* They use a minimalistic design. They assume that the stored data consists of plain-old-data objects (PODs). Constructors and destructors are not called for the stored objects and they are moved with raw *memmove()* operations rather than with copy constructors.

This simplifies the code and improves the performance (calling constructors and destructors is not free). It also saves us the headache of dealing with storing objects that must be constructed with Allocators.

Personally I like this minimalistic approach. If I want to keep non-POD data in a collection, I prefer to store it as pointers anyway, so I have control over when and how the data is constructed and destroyed. I don't like those things happening "behind my back". You may disagree of course, but in that case you are probably happy to use STL (or boost).

Another example of choosing minimalism is the *Hash<T>* class. The hash uses a fixed key type which is a *uint64_t*. If you want to use a key that doesn't fit into 64 bits, you have to hash it yourself before using it to access the data.

### And more?

I'm planning to add some basic math code to the library, but haven't gotten around to it yet.

Is there anything else you'd like to see in a library like this?

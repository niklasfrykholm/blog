# PIMPL vs Pure Virtual Interfaces

In C++, separating the *interface* (public declarations) of a class from its *implementation* (private methods, members and definitions) serves several useful purposes:

* Implementation details are hidden, making interfaces easier to read and understand.
* Smaller header files with fewer dependencies means faster compile times.
* A weaker coupling between the interface and the implementation gives greater freedom in reorganizing and refactoring the implementation internals.

In pure C, we can achieve this separation by using a pointer to a forward declared struct:

```cpp
struct SoundWorld;
typedef unsigned SoundInstanceId;

SoundWorld *make_sound_world();
void destroy_sound_world(SoundWorld *world);
SoundInstanceId play(SoundWorld *world, SoundResource *sound);
void stop(SoundWorld *world, SoundInstanceId id);
```

The struct is opaque to the users of the API. The actual content is defined in the *.cpp* file:

```cpp
struct SoundWorld {
    SoundInstance playing_instances[MAX_PLAYING_INSTANCES];
    Matrix4x4 listener_pose;
    ...
};
```

C++ programmers are often recommended to use the [PIMPL idiom](http://en.wikipedia.org/wiki/Opaque_pointer) (pointer to implementation) to achieve the same thing:

```cpp
class SoundWorldImplementation;

class SoundWorld
{
public:
    typedef unsigned InstanceId;

    SoundWorld();
    ~SoundWorld();

    InstanceId play(SoundResource *sound);
    void stop(InstanceId id);

private:
    SoundWorldImplementation *_impl;
};
```

Here, *SoundWorld* is the external interface of the class. All the messy stuff: instance variables, private methods, etc is found in the *SoundWorldImplementation* class, which is in the *.cpp* file.

The *_impl* pointer is created in the constructor and calls to the methods in *SoundWorld* are forwarded to the implementation object via method stubs:

```cpp
SoundWorld::SoundWorld()
{
    _impl = new SoundWorldImplementation();
}

InstanceId SoundWorld::play(SoundResource *sound)
{
    return _impl->play(sound);
}
```

Another solution to the same problem is to write the interface as an abstract, pure virtual class in the *.h* file and then create the implementation as a subclass in the *.cpp* file.

You don't see this solution recommended as much (at least not as a solution to this particular problem), but I actually like it better. With this approach, the header file will look something like this:

```cpp
class SoundWorld
{
public:
    typedef unsigned InstanceId;

    virtual ~SoundWorld() {}
    virtual InstanceId play(SoundResource *sound) = 0;
    virtual void stop(InstanceId id) = 0;

    static SoundWorld *make(Allocator &a);
    static void destroy(Allocator &a, SoundWorld *sw);
};
```

Note that since the class is now abstract, we cannot create actual instances of it, to do that we need the factory functions *make()* and *destroy()*. I've added an *allocator* parameter for good measure, because I always want to specify [explicit allocators](http://bitsquid.blogspot.se/2010/09/custom-memory-allocation-in-c.html) for all memory operations.

The corresponding *.cpp* file looks something like:

```cpp
class SoundWorldImplementation : public SoundWorld
{
    friend class SoundWorld;

    SoundInstance _playing_instances[MAX_PLAYING_INSTANCES];
    Matrix4x4 _listener_pose;

    SoundWorldImplementation()
    {
        ...
    }

    virtual InstanceId play(SoundResource *sound)
    {
        ...
    }

    virtual void stop(InstanceId)
    {
        ...
    }
};

SoundWorld *SoundWorld::make(Allocator &a)
{
    return a.make<SoundWorldImplementation>();
}

SoundWorld *SoundWorld::destroy(Allocator &a, SoundWorld *sw)
{
    return a.destroy<SoundWorldImplementation>(sw);
}
```

The reason why most people recommend the PIMPL approach is that it has some distinct advantages:

* Factory functions are not needed, you can use *new()*, *delete()* or create objects on the stack.
* The *SoundWorld* class can be subclassed.
* The interface methods are not virtual, so calling them *might be* faster. (On the other hand, we need an extra memory fetch to get to the implementation object.)
* PIMPL can be introduced in an existing class without changing its external interface or its relation to other classes.

For my use cases, none of these advantages matter that much. Since I want to supply my own allocators, I'm not interested in *new* and *delete*. And I only use this for "big" objects, that are always heap (rather than stack) allocated.

I don't make much use of implementation inheritance. In my opinion, it is almost always a bad design decision that leads to strongly coupled code and hard to follow code paths. Inheritance should be limited to interface inheritance.

The performance issue of virtual calls is not a huge issue, since I only use this for "big" objects (*Systems* and *Managers*). Also, I design the API so that the number of API calls is minimized. I.e., instead of a function:

```cpp
void set_sound_position(InstanceId id, const Vector3 &pos);
```

I have:

```cpp
void set_sound_positions(unsigned count, const InstanceId *ids, const Vector3 *positions);
```

This reduces the virtual call overhead, but also has additional benefits, such as being DMA friendly and allowing for parallelization and batch optimizations.

In the words of Mike Acton: *Where there's one, there's more than one.*

The abstract class method has some advantages of its own:

* Cleaner code and a lot less typing, since we don't have to write forwarding stubs for the methods in the public interface.
* Multiple classes can implement the same interface. We can statically or dynamically select which particular implementation we want to use, which gives us more flexibility.

To me, not having to write a ton of stupid boilerplate cruft is actually kind of a big deal. I know some people don't mind boilerplate. It's just a little extra typing, they say. Since there is nothing complicated or difficult in the boilerplate code, it doesn't pose a problem. Programmers are not limited by typing speed, so how much you have to type doesn't matter.

I don't agree at all. In my view, *every line* of code is a burden. It comes with a cost that you pay again and again as you write, read, debug, optimize, improve, extend and refactor your code. For me, the main benefit of "higher-level" languages is that they let me do more with less code. So I'm happy to pay the overhead of a virtual call if it saves me from having 150 lines of idiotic boilerplate.

A nice thing about the interface and implementation separation is that it gets rid of another piece of hateful C++ boilerplate: *method declarations* (hands up everybody who enjoys keeping their *.h* and *.cpp* files synchronized).

Methods defined inside a C++ class do not have to be declared and can be written in any order. So if we want to add helper methods to our implementation class, that are not part of the public interface, we can just write them anywhere in the class:

```cpp
class SoundWorldImplementation : public SoundWorld
{
    virtual InstanceId play(SoundResource *resource) {
        InstanceId id = allocate_id();
        ...
    }

    // A private method - no declaration necessary.
    InstanceId allocate_id() {
        ...
    }
};
```

It's interesting that this small, purely syntactical change -- getting rid of method declarations -- makes a significant different in how the language "feels". At least to me.

With this approach, adding a helper method feels like "less work" and so I'm more inclined to do it. This favors better structured code that is decomposed into a larger number of functions. More like Smalltalk than traditional C (home of the mega-method). The [Sapir-Worf hypothesis](http://en.wikipedia.org/wiki/Linguistic_relativity) appears to hold some merit, at least in the realm of programming languages.

Another interesting thing to note is that the pure C implementation of opaque pointers stacks up pretty well against the C++ variants. It is simple, terse and fast (no virtual calls, no forwarding functions).

Every year I'm a little more impressed by C and a little more depressed by C++.

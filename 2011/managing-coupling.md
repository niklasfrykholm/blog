# Managing Coupling

The only way of staying sane while writing a large complex software system is to regard it as a collection of smaller, simpler systems. And this is only possible if the systems are properly decoupled.

Ideally, each system should be completely isolated. The effect system should be the only system manipulating effects and it shouldn’t do anything else. It should have its own *update()* call just for updating effects. No other system should care how the effects are stored in memory or what parts of the update happen on the CPU, SPU or GPU. A new programmer wanting to understand the system should only have to look at the files in the *effect_system* directory. It should be possible to optimize, rewrite or drop the entire system without affecting any other code.

Of course, complete isolation is not possible. If anything interesting is going to happen, different systems will at some point have to talk to one another, whether we like it or not.

The main challenge in keeping an engine “healthy” is to keep the systems as decoupled as possible while still allowing the necessary interactions to take place. If a system is properly decoupled, adding features is simple. Want a wind effect in your particle system? Just write it. It’s just code. It shouldn’t take more than a day. But if you are working in a tightly coupled project, such seemingly simple changes can stretch out into nightmarish day-long debugging marathons.

If you ever get the feeling that you would prefer to test an idea out in a simple toy project rather than in “the real engine”, that’s a clear sign that you have too much coupling.

Sometimes, engines start out decoupled, but then as deadlines approach and features are requested that don’t fit the well-designed APIs, programmers get tempted to open back doors between systems and introduce couplings that shouldn’t really be there. Slowly, through this “coupling creep” the quality of the code deteriorates and the engine becomes less and less pleasant to work with.

Still, programmers cannot lock themselves in their ivory towers. “That feature doesn’t fit my API,” is never an acceptable answer to give a budding artist. Instead, we need to find ways of handling the challenges of coupling without destroying our engines. Here are four quick ideas to begin with:

#### 1. Be wary of “frameworks”.

By a “framework” I mean any kind of system that requires all your other code to conform to a specific world view. For example, a scripting system that requires you to add a specific set of macro tags to all your class declarations.

Other common culprits are:

* Root classes that every object must inherit from
* RTTI/reflection systems
* Serialization systems
* Reference counting systems

Such global systems introduce a coupling across the entire engine. They rudely enforce certain design choices on all subsystems, design choices which might not be appropriate for them. Sometimes the consequences are serious. A badly thought out reference system may prevent subsystems from multithreading. A less than stellar serialization system can make linear loading impossible.

Often, the motivation given for such global systems is that they increase maintainability. With a global serialization system, we just have to make changes at a single place. So refactoring is much easier, it is claimed.

But in practice, the reverse is often true. After a while, the global system has infested so much of the code base that making any significant change to it is virtually impossible. There are just too many things that would have to be changed, all at the same time.

You would be much better off if each system just defined its own *save()* and *load()* functions.

#### 2. Use high level systems to mediate between low level systems.

Instead of directly coupling low level systems, use a high level system to shuffle data between them. For example, handling footstep sounds might involve the animation system, the sound system and the material system. But none of these systems should know about the others.

So instead of directly coupling them, let the gameplay system handle their interactions. Since the gameplay system knows about all three systems, it can poll the animation system for events defined in the animation data, sample the ground material from the material system and then ask the sound system to play the appropriate sound.

Make sure that you have a clear separation between this messy gameplay layer, that can poke around in all other systems, and your clean engine code that is isolated and decoupled. Otherwise there is always a risk that the mess propagates downwards and infects your clean systems.

In the BitSquid Tech we put the messy stuff either in Lua or in Flow (our visual scripting tool, similar to Unreal’s Kismet). The language barrier acts as a firewall, preventing the spread of the messiness.

#### 3. Duplicating code is sometimes OK!

Avoiding duplicated code is one of the fundamentals of software design. Entities should not be needlessly multiplied. But there are instances when you are better off breaking this rule.

I’m not advocating copy-paste-programming or writing complicated algorithms twice. I’m saying that sometimes people can get a little overzealous with their code reuse. Code sharing has a price that is not always recognized, in that it increases system coupling. Sometimes a little judiciously applied code duplication can be a better solution.

An typical example is the *String* class (or *std::string* if you are thusly inclined). In some projects you see the *String* class used almost everywhere. If something is a string, it should use the *String* class, the reasoning seems to be. But many systems that handle strings do not need all the features that you find in your typical String class: locales, *find_first_of()*, etc. They are fine with just a *const char \**, *strcmp()* and maybe one custom written (potentially duplicated) three-line function. So why not use that, the code will be much simpler and easier to move to SPUs.

Another culprit is *FixedArray a.* Sure, if you write *int a[5]* instead you will have to duplicate the code for bounds checking if you want that. But your code can be understood and compiled without *fixed_array.h* and template instantiation.

And if you have any method that takes a *const Vector &v* as argument you should probably take *const T *begin, const T *end* instead. Now you don’t need the *vector.h* header, and the caller is not forced to use a particular *Vector* class for storage.

A final example: I just wrote a patching tool that manipulates our bundles (aka pak-files). That tool duplicates the code for parsing the bundle headers, which is already in the engine. Why? Well, the tool is written in C# and the engine in C++, but in this case that is kind of beside the point. The point is that sharing that code would have been a significant effort.

First, it would have had to be broken out into a separate library, together with the related parts of the engine. Then, since the tool requires some functionality that the engine doesn’t (to parse bundles with foreign endianness) I would have to add a special function for the tool, and probably a *#define TOOL_COMPILE* since I don’t want that function in the regular builds. This means I need a special build configuration for the tool. And the engine code would forever be dirtied with the *TOOL_COMPILE* flag. And I wouldn’t be able to rearrange the engine code as I wanted in the future, since that might break the tool compile.

In contrast, rewriting the code for parsing the headers was only 10 minutes of work. It just reads a vector of string hashes. It's not rocket science. Sure, if I ever decide to change the bundle format, I might have to spend another 10 minutes rewriting that code. I think I can live with that.

Writing code is not the problem. The messy, complicated couplings that prevent you from writing code is the problem.

#### 4. Use IDs to refer to external objects.

At some point one of your systems will have to refer to objects belonging to another system. For example, the gameplay layer may have to move an effect around or change its parameters.

I find that the most decoupled way of doing that is by using an ID. Let’s consider the alternatives.

`Effect *, shared_ptr`

> A direct pointer is no good, because it will become invalid if the target object is deleted and the effect system should have full control over when and how its objects are deleted. A standardshared_ptr won’t work for the same reason, it puts the life time of `Effect` objects out of the control of the effect system.

`Weak_ptr, handle`

> By this I mean some kind of reference-counted, indirect pointer to the object. This is better, but still too strongly coupled for my taste. The indirect pointer will be accessed both by the external system (for dereferencing and changing the reference count) and by the effect system (for deleting the `Effect` object or moving it in memory). This has the potential for creating threading problems.
> 
> Also, this construct kind of implies that external systems can dereference and use the `Effect` whenever they want to. Perhaps the effect system only allows that when its `update()` loop is not running and want to `assert()` that. Or perhaps the effect system doesn’t want to allow direct access to its objects at all, but instead double buffer all changes.

So, in order to allow the effect system to freely reorganize its data and processing in any way it likes, I use IDs to identify objects externally. The IDs are just an integers uniquely identifying an object, that the user can throw away when she is done with them. They don’t have to be “released” like a `weak_ptr`, which removes a point of interaction between the systems. It also means that the IDs are PODs. We can copy and move them freely in memory, juggle them in Lua and DMA them back-and-forth to our heart’s content. All of this would be a lot more complicated if we had to keep reference counts.

In the system we need a fast way of mapping IDs back to objects. Note that `std::map` is not a fast way! But there are a number of possibilities. The simplest is to just use a fixed size array with object pointers:

```cpp
Object *lookup[MAX_OBJECTS];
```

If your system has a maximum of 4096 objects, use 12 bits from the key to store an index into this array and the remaining 20 bits as a unique identifier (i.e., to detect the case when the original object has been deleted and a new object has been created at the same index). If you need lots of objects, you can go to a 64 bit ID.
That's it for today, but this post really just scratches the surface of decoupling. There are a lot of other interesting techniques to look at, such as events, callbacks and “duck typing”. Maybe something for a future entry...
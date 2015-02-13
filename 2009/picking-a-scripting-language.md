# Picking a scripting language

We are planning to make the BitSquid engine largely scripting language agnostic. We will expose a generic scripting interface from the engine and it should be relatively easy to bind that to whatever scripting language you desire.

Still, we have to pick some language to use for our own internal projects and recommend to others. I'm currently considering three candidates:

## C/C++

* Use regular C/C++ for scripting.
* Run it dynamically either by recompiling and relinking DLLs or by running an x86 interpreter in the game engine and loading compiled libs directly.

### Advantages

* Static typing
* Syntax checking & compiling can be done with an ordinary compiler
* When releasing the game we can compile to machine code and get full native speed

### Disadvantages

* C is not that nice for scripting
* Huge performance differences between "fully compiled" and "interactive" code makes it difficult for the gameplay programmers to do performance estimates.

## Lua

* Lua has the same feature set as Python and Ruby, but is smaller, more elegant and faster.
* Other scripting langues such as Squirrel, AngelScript offer reference counting and static typing, but are not as well known / used

### Advantages

* Dynamic, elegant, small
* Something of a standard as a game scripting language
* LuaJIT is very fast

### Disadvantages

* Non-native objects are forced to live on the heap
* Garbage collection can be costly for a realtime app
* Speed can be an issue compared to native code
* Cannot use LuaJIT on consoles

## Mono

* Use the Mono runtime and write scripts in C#, Boo, etc.

### Advantages

* Static typing
* Popular, fast

### Disadvantages

* Huge, scary runtime
* Garbage collection
* Requires license to run on console
* Can probably not JIT on console

# A new way of organizing header files

Recently, I've become increasingly dissatisfied with the standard C++ way of organizing header files (one *.h* file and one *.cpp* file per class) and started experimenting with alternatives.

I have two main problems with the ways headers are usually organized.

First, it leads to long compile times, especially when templates and inline functions are used. Fundamental headers like *array.h* and *vector3.h* get included by a lot of other header files that need to use the types they define. These, in turn, get included by other files that need *their* types. Eventually you end up with a messy nest of header files that get included in a lot more translation units than necessary.

Sorting out such a mess once it has taken root can be surprisingly difficult. You remove an *#include* statement somewhere and are greeted by 50 compile errors. You have to fix these one by one by inserting missing *#include* statements and forward declarations. Then you notice that the Android release build is broken and needs additional fixes. This introduces a circular header dependency that needs to be resolved. Then it is on to the next *#include* line -- remove it, rinse and repeat. After a day of this mind-numbingly boring activity you might have reduced your compile time by four seconds. Hooray!

Compile times have an immediate and important effect on programmer productivity and through general bit rot they tend to grow over time. There are many things that can increase compile times, but relatively few forces that work in the opposite direction.

It would be a lot better if we could change the way we work with headers, so that we didn't get into this mess to begin with.

My second problem is more philosophical. The basic idea behind object-oriented design is that data and the functions that operate on it should be grouped together (in the same class, in the same file). This idea has some merits -- it makes it easier to verify that class constraints are not broken -- but it also leads to problems. Classes get coupled tightly with concepts that are not directly related to them -- for example things like serialization, endian-swapping, network synchronization and script access. This pollutes the class interface and makes reuse and refactoring harder.

Class interfaces also tend to grow indefinitely, because there is always "more useful stuff" that can be added. For example, a string class (one of my pet peeves) could be extended with functionality for tokenization, path manipulation, number parsing, etc. To prevent "class bloat", you could write this code as external functions instead, but this leads to a slightly strange situation where a class has some "canonized" members and some second-class citizens. It also means that the class must export enough information to allow any kind of external function to be written, which kind of breaks the whole *encapsulation* idea.

In my opinion, it is much cleaner to organize things by *functionality* than by type. Put the serialization code in one place, the path manipulation code in another place, etc.

My latest idea about organization is to put all type declarations for all structs and classes in a single file (say *types.h*):

```cpp
struct Vector3 {
	float x, y, z;
};

template <class T>
class Array<T> {
public:
	Array() : _capacity(0), _size(0), _data(0) {}
	~Array() {free(_data);}
	unsigned _capacity;
	unsigned _size;
	T *_data;
};

class IFileSystem;
class INetwork;
```

Note that *types.h* has no function declarations, but it includes the full data specification of any struct or class that we want to use "by value". It also has forward declarations for classes that we want to use "by reference". (These classes are assumed to have pure virtual interfaces. They can only be created by factory functions.)

Since *types.h* only contains type definitions and not a ton of inline code, it ends up small and fast to compile, even if we put all our types there.

Since it contains all type definitions, it is usually the only file that needs to be included by external headers. This means we avoid the hairy problem with a big nest of headers that include other headers. We also don’t have to bother with inserting forward declarations in every header file, since the types we need are already forward declared for us in *types.h*.

We put the function declarations (along with any inline code) in the usual header files. So *vector3.h* would have things like:

```cpp
inline Vector3 operator+(const Vector3 &a, const Vector3 &b)
{
	Vector3 res;
	res.x = a.x + b.x;
	res.y = a.y + b.y;
	res.z = a.z + b.z;
	return res;
}
```

*.cpp* files that wanted to use these operations would include *vector3.h*. But *.h* files and other *.cpp* files would not need to include the file. The file gets included where it is needed and not anywhere else.

Similarly, *array.h* would contain thinks like:

```cpp
template <class T>
void push_back(Array<T> &a, const T &item)
{
	if (a._size + 1 > a._capacity)
		grow(a);
	a._data[a._size++] = item;
}
```

Note that *types.h* only contains the constructor and the destructor for *Array<T>*, not any other member functions.

Furthermore, I prefer to design classes so that the "zero-state" where all members are zeroed is always a valid empty state for the class. That way, the constructor becomes trivial, it just needs to zero all member variables. We can also construct arrays of objects with a simple *memset()*.

If a class needs a more complicated empty state, then perhaps it should be an abstract interface-class instead of a value class.

For *IFileSystem*, *file_system.h* defines the virtual interface:

```cpp
class IFileSystem
{
	virtual bool exists(const char *path) = 0;
	virtual IFile *open_read(const char *path) = 0;
	virtual IFile *open_write(const char *path) = 0;
	...
};

IFileSystem *make_file_system(const char *root);
void destroy_file_system(IFileSystem *fs);
```

Since the “open structs” in *types.h* can be accessed from anywhere, we can grop operations by what they do rather than by what types they operate on. For example, we can put all the serialization code in *serialization.h* and *serialization.cpp*. We can create a file *path.h* that provides path manipulation functions for strings.

An external project can also "extend" any of our classes by just writing new methods for it. These methods will have the same access to the *Vector3* data and be called in exactly the same way as our built-in ones.

The main drawback of this model is that internal state is not as "protected" as in standard object-oriented design. External code can "break" our objects by manipulating members directly instead of using methods. For example, a stupid programmer might try to change the size of an array by manipulating the *_size* field directly, instead of using the *resize()* method.

Naming conventions can be used to mitigate this problem. In the example above, if a type is declared with *class* and the members are preceded by an underscore, the user should not manipulate them directly. If the type is declared as a *struct*, and the members do not start with an underscore, it is OK to manipulate them directly. Of course, a stupid programmer can still ignore this and go ahead and manipulate the members directly anyway. On the other hand, there is no end to the things a stupid programmer can do to destroy code. The best way to protect against stupid programmers is to not hire them.

I haven’t yet written anything really big in this style, but I've started to nudge some files in the Bitsquid codebase in this direction, and so far the experience has been positive.

# Coding Style

This document describes the coding style you should use when working on code for the Stingray engine and tools.

## Table of Contents

* [C++ Code](#c++-code)
  * [Introduction](#introduction)
  * [Naming](#naming)
  * [Braces and Scopes](#braces-and-scopes)
  * [Indentation and Spacing](#indentation-and-spacing)
  * [Comments](#comments)
  * [Design and Implementation Issues](#design-and-implementation-issues)
  * [C++11 Features](#c++11-features)
  * [Miscellaneous Tidbits](#miscellaneous-tidbits)
* [C# Code](#c#-code)
  * [Braces](#braces)
  * [Naming](#naming)
  * [Organization](#organization)

## C++ Code

This section describes the coding style for C++ code, and also general coding guidelines that are useful regardless of what languge you are using.

For C#, JavaScript, Lua and Ruby we use different naming conventions than for C++ to match the standards for those langauges. These standards are described in langauge specific sections below.

### Introduction

#### A common style is good

A common coding style is useful. It makes it easier to communicate, and it makes the code easier to read.

#### Some choices are arbitrary

Some of the style choices described in this manual are (at least according to me) very well motivated, other are just arbitrary. Sometimes there is no reason to pick one particular style over another, but it is still useful to mandate a specific choice to ensure a consistent style.

#### Some things don't matter

The purpose of this style guide is not to cover every possible situation. If something is not covered by this guide it is probably something that doesn't matter that much and you are free to use whatever style you are most accustomed to. If you think something should be in the guide, just bring it up to discussion.

#### Avoid revision wars

If you see something that obviously does not follow the standard in a source file you should feel free to change it. If you see something that perhaps does not follow the standard, but you are not sure, it is better to leave it.

There is not much point in going over the entire codebase looking for style violations. Such nitpicking is not very productive. Instead, just fix the style violations in code you are working on anyway.

Avoid changing the style back and forth in the same piece of code. If you cannot agree on the style, talk about it instead of having a "cold war" in the codebase.

If you disagree strongly with one of the rules in this style guide, you should propose a change to the rule rather than silently rebel.

### Naming

#### Naming is important

Naming is a fundamental part of programming. The ease-of-use and "feeling" of an API depends a lot on having good names.

Furthermore, names are harder to change than implementations. This is especially true for names that are exported outside the executable itself, such as names for script functions and parameters in JSON files. For this reason, some care should be taken when selecting a name.

#### Names should provide all necessary information, nothing more

A name should provide all the necessary information to understand what a function or variable is doing but no more than that. I.e., it should not contain redundant information or information that is easily understood from the context (such as the class name).

```cpp
// BAD: Name provides too little information
char *pstoc(char *);
float x;
void Image::draw(float, float);

// BAD: Name provides too much information
char *convert_string_in_pascal_string_format_to_c_string_format(char *);
float the_speed;
void Image::draw_image_at(float, float);

// GOOD: Just the right amount
char *pascal_string_to_c(char *s);
float speed;
void Image::draw_at(float x, float y);
```

If you cannot come up with a good name for something -- think harder and consult your colleagues. Never use a name that you know is bad.

```cpp
// BAD:
// What is link2? How it is different from link?
void link();
void link2();

// These names don't mean anything.
Stuff the_thing;
```

#### A bigger scope warrants a more descriptive name

The more visible a variable is (the larger scope it has) the more descriptive its name needs to be, because less information is provided by the context.

Consider the number of players in a network game. In a small local loop, it is fine to call the variable `n` because there is not much to confuse it with, and the context immediately shows where the variable is coming from.

```cpp
int n = num_players();
for (int i = 0; i < n; ++i)
    ...
```

If it is a function in the network class we need to be more verbose, because `n` could mean any number of things in that context.

```cpp
int Network::num_players();
```

If it is a global variable, we must be even more verbose, because we no longer have a Network class context that tells us the variable has something to do with the network:

```cpp
int _num_players_in_network_game;
```

**NOTE:** Global variables should be avoided. If you really need a global variable, you should hide it behind a function interface (e.g., `console_server::get()`). This reduces the temptation of misusing the variable.

#### Do not use abbreviations in names

There are two problems with abbreviations in names:

* It gets harder to understand what the name means. This is especially the case with extreme and nonsensical abbreviations like `wbs2mc()`.
* Once you start to mix abbreviated and non-abbreviated names, it becomes hard to remember which names where abbreviated and how. It is not hard to understand that `world_pos` means `world_position`. But it can be hard to remember whether the function was called `world_pos` or `world_position` or something else. Never using abbreviation makes it much easier to guess what a function should be called.

The general rule is "do not use any abbreviations at all". The only allowed exception is:

* `num_`

which means number of, e.g. `num_players()` instead of `number_of_players()`.

Note that the rule against abbreviations only applies to exported symbols. A local variable can very well be called `pos` or `p`.

#### Use sensible names

* Spell your names correctly.
* Do not write the words `to` and `for` as `2` and `4`.
* All names and comments should be in American English.

#### Name functions and variables `like_this()`

Use lower case characters and underscores where you would put spaces in a normal sentence.

This style is preferred for functions and variables, because it is the most readable one (most similar to ordinary language) and functions and variables are the things we have most of.

Do not use any kind of Hungarian notation when naming variables and functions. Hungarian serves little purpose other than making the code less readable.

#### Name classes `LikeThis`

It is good to use a different standard for classes than variables, because it means that we can give temporary variables of a class good names:

```cpp
Circle circle;
```

If the class was called circle, the variable would have to be called something horrible like `a_circle` or `the_circle` or `tmp`.

#### Name member variables `_like_this`

Being able to quickly distinguish member variables from local variables is good for readability... and it also allows us to use the most natural syntax for getter and setter methods:

```cpp
const Circle &circle() const { return _circle; }
void set_circle(const Circle &circle) { _circle = circle; }
```

A single underscore is used as a prefix, because a prefix with letters in it (like `m_`) makes the code harder to read.

This _sentence can _be _easily read _even though _it _has _extra underscores.

But m_throw in m_some letters m_and it m_is m_not so m_easy m_anymore, m_kay.

Also, using underscores makes the member variables stand out more, since there could be other variables starting with m.

#### Name macros ```LIKE_THIS```

It is good to have `#define` macro names really standing out, since macros can be devious traps when it comes to understanding the code. (Like when Microsoft redefines `GetText` to `GetTextA`.)

#### Name namespaces `like_this`

This is the most readable syntax, so we prefer this when we don't have any reason to do otherwise.

#### Name enums `LikeThis`, and enum values `LIKE_THIS`

Enums are types, just as classes and structs and should follow the same naming convention.

Enum values are used in the same way as #defines of integer constants and as a user of an API you don't care if a constant is implemented with an enum or with a a macro. Therefore we use the same naming convention.

Enums should use the `enum class` feature of C++11 to avoid exporting the enum names to the enclosing scope:

```cpp
enum class Align {LEFT, RIGHT, CENTER};
```

#### Name files `like_this.cpp`

Again, this is the most readable format, so we choose that when we don't have a reason to do something else.

The `.h` files should be put in the same directory as the `.cpp` files, not in some special "include" directory, for easier navigation between the files.

#### Standard functions

Getter and setter functions should look like this.

```cpp
const Circle &circle() const { return _circle; }
void set_circle(Circle &circle) { _circle = circle; }
```

The getter is called `circle` rather than `get_circle`, since the `get_` prefix is superfluous. However, we use a `set_` prefix to emphasize that we are changing the state of the object.

### Braces and Scopes

Use braces to increase readability in nested scopes

Instead of

```cpp
// BAD
while (a)
    if (b)
        c;
```

Write

```cpp
while (a) {
    if (b)
        c;
}
```

Only the innermost scope is allowed to omit its braces.

#### Fit matching braces on a single screen

The opening and closing of a brace should preferably fit on the same screen of code to increase readability.

Class and namespace definitions can of course cover more than one screen.

Function definitions can sometimes cover more than one screen -- if they are clearly structured -- but preferably they should fit on a single screen.

`while`, `for` and `if` statements should always fit on a single screen, since otherwise you have to scroll back and forth to understand the logic.

Use `continue`, `break` or even (gasp) `goto` to avoid deep nesting.

Code that is indented four or five times can be very hard to read. Often such indentation comes from a combination of loops and `if`-statements:

```cpp
// BAD
for (int i = 0; i < parent->num_children(); ++i) {
    Child child = parent->child(i);
    if (child->is_cat_owner()) {
        for (int j = 0; j < child->num_cats(); ++j) {
            Cat cat = child->cat(j);
            if (cat->is_grey()) {
                ...
```

Using continue to rewrite gives a clearer structure:

```cpp
for (int i = 0; i < parent->num_children(); ++i) {
    Child child = parent->child(i);
    if (!child->is_cat_owner())
        continue;

    for (int j = 0; j < child->num_cats(); ++j) {
        Cat cat = child->cat(j);
        if (!cat->is_grey())
            continue;

        ...
```

Excessive indentation can also come from error checking:

```cpp
// BAD
File f = open_file();
if (f.valid()) {
    std::string name;
    if (f.read(&name)) {
        int age;
        if (f.read(&age)) {
            ...
        }
    }
}
```
 
This is one of the few cases where `goto` can be validly used:

```cpp
File f = open_file();
if (!f.valid())
    goto err;

std::string name;
if (!f.read(&name))
    goto err;

int age;
if (!f.read(&age))
    goto err;

err:
    ...
```

Local helper lambda functions is another good way of avoiding deep nesting.

#### The three bracing styles and when to use them

There are three bracing styles used:

```cpp
// Single line
int f() const { return 3; }

// Opened on same line
while (true) {
    do(stuff);
     more(stuff);
}

// New line
int X::f() const
{
    return 3;
}
```

The first style is typically used for getter and setter functions in the header file to make the header more compact.

The second style is the default for while loops and for-loops with more than one line.

This third is used for class declarations and function declarations in the `.cpp` file.

Consistent bracing style is not super important, but in general the rule should be that the more that is enclosed by the brace, the more space there should be in the brace.

### Indentation and Spacing

#### Use tabs for indentation

Tabs gives users more flexibility in controlling the indentation.

You should set your editor to display the tabs as four spaces. This provides a good compromise between readability and succinctness.

#### Use spaces to align columns

The start of a line should always be indented with tabs, but if you want to align some other column of code you should use spaces:

```cpp
void f()
{
	int some_var    = 1;
    int another_var = 2;
    int x           = 3;
}
```

This ensures that the columns line up even if a different tab setting is used. Even if we always view the source with four spaces for tabs, external viwers such as diff tools or github may use a different setting. We should ensure that the code always looks good.

#### No extra spaces at end of line

There should be no whitespace at the end of a line. Such invisible whitespace can lead to merge issues.

Empty lines are an exception. Empty lines may contain indentation tabs, but they should have no extra whitespace apart from the indentation tabs.

#### Think about evaluation order when placing spaces

For statements, put a space between keywords and parenthesis, put a space before braces on the same line. Do not put any space before a semicolon.

```cpp
while (x == true) {
    do_stuff();
}
```
 
Placement of spaces in expressions is not that important. We generally tend to put a space around every binary operator, but not around unary operators (such as array access, function calls, etc).

```cpp
z = x * y(7) * (3 + p[3]) - 8;
```

You can use a more terse or a more loose style if you want to, but make sure that the placement of spaces reflects the evaluation order of the expression. I.e. begin by removing spaces around operators that have a higher order of precedence. This is OK:

```cpp
z = x*y(7)*(3 + p[3]) - 8;
```
 
Because * has higher precedence than - and =. This is confusing and not OK:

```cpp
// BAD
z=x * y(7) * (3+p [3])-8;
```
 
#### Make lines reasonably long

A lot of style guides say that lines should never be more than 80 characters long. This is overly restrictive. We all have displays that can show more than 80 characters per line and nobody prints their code anymore.

Never write code like this:

```cpp
// BAD
int x = the + code +
    is + indented +
    and + I + dont +
    want + to + create
    + long + lines;
```

Either use less indentation or write longer lines.

Don't go crazy with line lengths, scrolling to see the end of the line is annoying. Also, make sure not to put very important stuff far to the right where it might be clipped from view.

#### General guidelines for spaces

* Put a space between `if`, `for`, `while` and the parenthesis that follows.
* Do not put a space between the function name and the parenthesis in a function call.
* Do not put spaces inside parenthesis.
* Put spaces after commas, do not put spaces before commas.
* In a variable declaration, do not put a space after `*` or `&`.

```cpp
// GOOD
if (x)
for (int i = 0; i < 3; ++i)
memset(&a, 0, sizeof(a));
void f(const T &t)

// BAD
if(x)
for(int i = 0; i < 3; ++i)
memset ( &a,0,sizeof(a) );
void f(const T & t)
```

#### Indent `#if` statements

By default, the visual studio editor left flushes all preprocessing macros. This is idiotic and makes the code really hard to read, especially when the macros are nested:

```cpp
// BAD
void f()
{
#ifdef _WIN32
#define RUNNING_WINDOWS
#ifdef PRODUCTION
    bool print_error_messages = true
#else
    bool print_error_messages = false
#endif
#else
    bool win32 = false
#endif
```

Instead, indent your macros just as you would normal C code:

```cpp
void f()
{
    #ifdef _WIN32
        #define RUNNING_WINDOWS
        #ifdef PRODUCTION
            bool print_error_messages = true
        #else
            bool print_error_messages = false
        #endif
    #else
        bool win32 = false
    #endif
}
```

In visual studio go to **Tools > Text Editor > C/C++ > Tabs** and change `Indenting` from `Smart` to `Block` to prevent the default indenting.

#### Do not indent the entire file

When the entire file is inside one (or several) namespaces, you should not indent the entire file. Indenting an entire file does not increase readability, it just means you will fit less code on the screen.

Instead, put a comment on the closing brace.

```cpp
namespace stingray
{
void x();
...
} // namespace stingray
```

When the namespace declaration does not cover the entire file, but only a screenfull or so, then it can be a good idea to indent it.

### Comments

#### Use `//` for descriptive comments `/*` for disabling code

`//` comments are better for comments that you want to leave in the code, because they don't have any nesting problems, it is easy to see what is commented, etc.

`/*` is useful when you want to quickly disable a piece of code.

#### Do not leave disabled code in the source

Commenting out old bad code with `/* ... */` is useful and necessary.

It can be useful to leave the old commented out code in the source file *for a while*, while you check that the new code does not have any bugs, performance problems, etc. But once you are sure of that you should remove the commented out code from the file.

Having a lot of old, unused, commented out code in the source files makes them harder to read, because you constantly ask yourself why was this commented out, maybe the solution to my problem lies in this commented out code, etc. Source control already keeps a version history, we don't need to keep old code in comments.

#### Use comments as hints to the reader

The main source of information about what the code does should be the code itself. The code is always up-to-date, it doesn't lie and no extra effort is required to maintain it. You should not need to add comments that explain what the code does:

```cpp
// BAD

// Returns the speed of the vehicle
float sp() {return _sp;}

// Computes speed from distance and time
s = d / t;

// Check for end of file
if (c == -1)
```

Instead, write code that is self-explanatory.

```cpp
float speed() const { return _speed; }

speed = distance / time;

if (c == END_OF_FILE_MARKER)
```

Source code comments should be used as hints to the reader who tries to understand the code. They should point out when the code does something which is a little bit clever or tricky, something that may not be immediately obvious from reading just the code. In complicated algorithms that consist of several steps, they are also useful for identifying the separate steps and giving the user a sense of context.

```cpp
// Use Duff's device for loop unrolling
// See for example: http://en.wikipedia.org/wiki/Duff's_device
switch (count % 8)
{
    case 0: do { *to = *from++;
    case 7:      *to = *from++;
    case 6:      *to = *from++;
    case 5:      *to = *from++;
    case 4:      *to = *from++;
    case 3:      *to = *from++;
    case 2:      *to = *from++;
    case 1:      *to = *from++;
               } while ((count -= 8) > 0);
}
```

#### Avoid boilerplate comments

The purpose of comments is to convey information. Avoid big cut-and-paste boilerplate comments in front of classes and functions. Make the comments succint and to the point. There is no point in repeating information in the comment that is already in the function header, like this:

```cpp
// BAD
// p1 a point
// p2 another point
// Returns the distance between p1 and p2
float distance(const Vector3 &p1, const Vector3 &p2);
```

You don't have to comment every single function in the interface. If the function's meaning is clear from its name, then adding a comment conveys no extra information. I.e... this is pointless:

```cpp
// BAD
// Returns the speed.
float speed();
```
 
Do not add a super heavy boilerplate comments to functions with parameters, return values, etc. Such comments tend to contain mostly fluff anyway. They convey no more information than a simple comment and they make it much harder to get an overview of the code.

I.e. avoid fluff pieces like this:

```cpp
// BAD
/************************************************************
* Name: cost
*
* Description: Returns the cost of going from point p1 to p2.
* Note: Cost of going in z direction is 2 times as expensive.
*
* Parameters:
* p1 - The one point
* p2 - The other point
* Return value:
* The cost of going from p1 to p2.
*************************************************************/
static inline float cost(const Vector3 &p1, const Vector3 &p2) const;
```

Stingray does not use Doxygen, so avoid using Doxygen markup in your function comments. Instead write them in plain English. Note that we *used to* use Doxygen, so there is a fair ammount of Doxygen markup still left in the code base. This will be cleaned up over time.

Also, since we are not using Doxygen, avoid using `\\\` for comments, just use plain `\\` instead.

If you need to add markup to your comments to highlight specific words, you should use Markdown syntax.

#### Don't put high level documentation in source code comments

Source code comments are not and should not be the only kind of documentation. Source code comments are good for documenting details that are directly related to the code, such as reference documentation for an API.

Aside from detail documentation, systems also need high level documentation. The high level documentation should provide an overview of the system and an entry point for programmers who are new to the system. It should explain the different concepts that are used in the system and how they relate to each other, the goals of system and the different design choices that have been made.

High level documentation should not be put in source code comments. That makes it fragmented and hard to read. Instead, it should be created as an HTML document, where the user can read it as a single continuous text with nice fonts, illustrations, examples, etc.

#### Put interface documentation in the .h file

Put interface (function and class documentation) in the .h file. This makes it easier to find all the relevant interface documentation for someone browsing the .h files.

A drawback of this is that the .h files will become bigger and harder to grasp, but that is a price we are willing to pay.

### Design and Implementation Issues

#### Optimize wisely

All the code in the engine does not have to be super optimized. Code that only runs once-per-frame has very little impact on a game's performance. Do not spend effort on optimizing that code. Consider what are the heavy-duty number-crunching parts of the code and focus your efforts on them. Use the profiler as a guide to finding the parts of the code that matter.

Be very wary of sacrificing simplicity for code efficiency. Your code will most likely live for a long time and go through several rounds of optimization and debugging. Every time you add complexity you make future optimizations more difficult. Thus, an optimization that makes the code faster today may actually make it slower in the long run by preventing future optimizations. Always strive for the simplest possible code. Only add complexity when it is absolutely necessary.

Be aware that the rules of optimization have changed. Cycle counts matter less. Memory access patterns and parallelization matter more. Write your optimizations so that they touch as little memory as possible and as linearly as possible. Write the code so that it can be parallelized and moved to SPUs. Focus on data layouts and data transforms. Read up on data oriented design.

### C++11 Features

The Stingray engine is compiled using C\+\+11, but not all C\+\+11 features are supported by all the compilers we support. (Generally, Visual Studio 2012 sets the low bar.) The features listed below are the C\+\+11 features that are known to be working and that we recommend using.

#### `auto`

Using the `auto` type is recommended for declaring complex types such as `Array<Item>::const_iterator`. For simple standard types, such as `int` or `char *` it is usually clearer not to use `auto`.

#### `decltype()`

Use this if you need it.

#### Range based for loops

Use this instead of regular for loops where it makes the code simpler to read.

#### lambda functions

Use lambda functions whenever you need a small local helper function in a function.

```cpp
void format_markdown(const char *s)
{
	auto is_header = [](const char *line) {
    	return line[0] == '#';
    };

    ...
}
```

#### `stdint.h` types `int8_t`, `uint8_t`, `int32_t`, `uint32_t`, ...

We assume that any compiler compiling the Stingray project has sensible type sizes, i.e.:

* `char` = 8 bits
* `short` = 16 bits
* `int` = 32 bits

Still, for integer sizes other than 32 bit, the `stdint.h` types should be used as they are less ambiguous:

* Use: `int8_t`, `int16_t`, `uint64_t`, ...
* Rather than: `char`, `short`, `size_t`, `long long`, ...

Note that a lot of the code still uses `short` and `long` though. It has not yet been rewritten to use the new types.

For 32-bit integers, both the ANSI types and the `stdint.h` types can be used:

* `int`, `int32_t`
* `unsigned`, `uint32_t`

The ANSI types are currently preferred (but we are considering changing that). Don't use the formats `signed int` or `unsigned int`.

When you are referring to a string or a buffer of raw data you should still use `char *` rather than `int8_t *`. Use `int8_t` when you want a small integer.

#### `override`, `final`

These keywords should be used to document the intent of virtual methods.

#### `enum class`

Most enums should be written to use `enum class` to avoid the leaky scope of regular enums.

#### `static_assert`

Use this everywhere possible to detect compile time errors.

### Miscellaneous Tidbits

#### `#pragma once`

Use `#pragma once` to avoid multiple header inclusion

All current compilers understand the `#pragma once` directive. And it is a lot easier to read than the standard `#ifndef` syntax:

```cpp
// BAD
#ifndef _MY_UNIQUE_HEADER_NAME_H_
#define _MY_UNIQUE_HEADER_NAME_H_
    ...
#endif

// GOOD
#pragma once
```

#### (pointer, size)

When writing a function that takes a pointer and a size/count as parameters, following the standard of the standard C library (`memcpy`, etc) the pointer argument should be passed first and the size argument last. I.e.:

```cpp
void do_something(char *data, unsigned len);
```

#### (type, name)

When writing functions that take a resource type and resource name as arguments, the type argument should precede the name argument, i.e. as in:

```cpp
bool can_get(const ResourceID &type, const ResourceID &name) const;
```

## C# Code

This section details the coding style used for C# code in the Stingray tools. You should also read the Stingray - Developer Guidelines document, which details the values we adhered to when developing the engine. You should also read Stingray - C# Developer Guidelines and ensure you are comfortable with the concepts described therein.

### Braces

Use the standard .NET block brace style. This means both starting and ending braces always reside on their own line. The only exception to this rule is simple properties, where the get and set statements can be reduced to a single line each.

```c#
namespace Bitsquid
{
    public class Resource
    {
        public string AbsolutePath
        {
            get { return _absolute_path; }
            set { _absolute_path = value; }
        }

        public IEnumerable<string> GetDependencyPaths()
        {
            var paths = new List<string>();

            foreach (var dependency in Dependencies)
            {
                var path = dependency.AbsolutePath;
                paths.Add(path);
            }

            return paths;
        }
    }
}
```

#### Omitting braces

You are allowed to omit braces in the following situation:

```c#
while (test)
{
    // Simple test, single statement.
    if (another_test)
        DoSomething();

    // Always add an empty line after such a statement.
    DoAnotherThing();
}
```

But not in these situations:

```c#
// BAD - Multiple simple statements make scope unclear.
while (test)
    if (another_test)
        DoSomething();

// BAD - All sections of a complex branch should have braces.
if (test)
    DoSomething();
else
{
    DoSomethingElse();
}
```

### Naming

While C\+\+ does not really have a standard naming convention, C# ships with a huge library of functionality in the .NET Framework. In order to conform better to the .NET Framework naming style, we use slightly different naming rules in our C# code compared to our C\+\+ code.

#### Name namespaces `LikeThis`

Namespaces should conform to the directory structure on disk. There are very few exceptions to this rule.

#### Name classes and structs `LikeThis`

This conforms to both our general naming guidelines and the convention used in the .NET Framework. Consider ending the name of derived classes with the name of the base class.

```c#
public class Resource
{
    ...
}
public class MeshResource : Resource
{
    ...
}
```

#### Name interfaces `ILikeThis`

Interfaces follow the same naming rules as classes, but are prefixed by the capital letter `I`.

Interfaces that enforce a set of abilities rather than represent a service are typically suffixed "able", for example `IEnumerable`, `IHashable`, `ISortable`.

Ensure that when defining a class/interface pair where the class is a standard implementation of the interface, the names differ only by the letter I prefix on the interface name.

```c#
public interface IConnection
{
    ...
}

public interface IJsonSerializable
{
    ...
}
```

#### Name variables and method arguments `like_this`

Use lower case characters and underscores where you would put spaces in a normal sentence. While this convention does not confirm to the .NET standard library, it is used for both the C++ code and Lua scripts we ship with the engine. Choosing a different convention than the .NET Framework library in this case has very little impact, since the public interface remains unchanged.

A special case is boolean variables, who are typically prefixed with either `is_`, `can_` or `has_`.

#### Name member variables `_like_this`

Being able to quickly distinguish member variables from local variables is good for readability.

```c#
public class Resource
{
    private int _reference_count;
    private bool _is_relative;
}
```

A single underscore is used as a prefix, because a prefix with letters in it (like `m_`) makes the code harder to read.

This _sentence can _be _easily read _even though _it _has _extra underscores.
But m_throw in m_some letters m_and it m_is m_not so m_easy m_anymore, m_kay.

Also, using `_` makes the member variables stand out more, since there could be other variables starting with `m`.

#### Name methods `LikeThis()`

Use capital letters for the start of every word, including the first word.

Functions that perform some calculation and return a value without modifying object state are typically prefixed with `Get`.

```c#
private IEnumerable< string > GetExistingFilePaths()
{
    return _absolute_paths.Where(File.Exists);
}
```

#### Name properties `LikeThis`

Use capital letters for the start of every word, including the first word. Name properties using a noun, noun phrase, or an adjective.

#### Boolean properties

Boolean properties are typically prefixed with either `Is`, `Can` or `Has`.

```c#
private bool CanScrollHorizontally
{
    get { return _can_scroll_horizontally; }
    set { _can_scroll_horizontally = value; }
}
```

#### Name constants and enum entries `LikeThis`

This conforms to the .NET framework naming style.

#### Name enums and enum values `LikeThis`

Enums are types, just as classes and structs and should follow the same naming convention.

You should not include the enumeration type name in the enumeration value names. Use a singular name for an enumeration unless its values are bit fields. If its values are bit fields, it should have a plural name.

```c#
public enum GeometryType
{
    Box,
    Sphere,
    Capsule,
    Mesh,
}

[Flags]
public enum FileAttributes
{
    Read = 1,
    Write = 2,
    Execute = 4,
}
```

#### Indentation and Spacing

Please indent code within namespaces

Contrary to C++, C# allows writing out the full namespace path on a single line, so we can indent the entire contents of namespaces.

```c#
namespace Stingray.View.ValueConverters
{
    public class NumericValueConverter : IValueConverter
    {
        ...
    }
}
```

### Organization

Use one file per class, interface, enum or other declaration. Even if your interface or enum is just a few lines.

The file name should mirror the class name. We use standard .NET naming style for files, so a file containing the class Resource should be named Resource.cs on disk. This conforms to the default file name given to new classes and interfaces by Visual Studio and ReSharper.

Classes that are located within a namespace are expected to be below a folder of the same name both on disk and in the solution. Folders should contain additional folders for nested namespaces.

#### Organize `using` statements

Keep your `using` statements nicely organized at the top of the file in order to minimize merge conflicts. Use the following rules to organize using statements:

* Using statements should be placed at the top of the file.
* Using statements should not be indented.
* Using statements should be ordered alphabetically.
* Using statements referring to the System namespace are ordered before all other using statements.
* Using statements that define aliases are ordered after all other using statements.
* Using statements that are not required by the code inside the file should be removed.

ReSharper can organize your using statements automatically according to this rule set. Simply right-click anywhere in the code and select **Organize Usings > Remove and Sort** from the context menu.

#### Put state at the top of the class

All state members should be put at the top of the class declaration, so all the mutable state can be surveyed at-a-glance. This includes automatic properties. Do not attempt to separate automatic properties from member variables - they both represent state, and it is common for an automatic property to be converted into a property with a backing field or the other way around.

```c#
public class Resource
{
    // State
    public string AbsolutePath { get; private set; }
    private bool _is_relative;

    public Resource(string path)
    {
        ...
    }
}
```

#### Initialize members in constructors

If you do not initialize a variable, it will be initialized to the value yielded by the `default(T)` expression, where `T` is the type of the member variable. This yields `0` for numeric variables, `false` for booleans, `null` for reference types and the result of calling the non-argument constructor for structs.

While C# allows you to initialize member variables on the same line as they are declared, it is good practice to initialize member variables in the constructor instead. This ensures all the initialization code is in one place, and allows members to be initialized from constructor arguments.

```c#
public class Resource
{
    // State
    public string AbsolutePath { get; private set; }
    private bool _is_relative = true; // BAD! Do it in the constructor instead.

    public Resource(string path)
    {
        AbsolutePath = path;
        _is_relative = IsRelativePath(path);
    }
}
```

#### Style Considerations

Code is read more often than it is written. We want to leverage modern C# features whenever we can, since they all contribute to making the code more readable. Note that ReSharper will notify you of most of these style issues, and can even perform these changes automatically.

#### Modifier keywords

We always specify accessibility keywords explicitly in our declarations:

```c#
// BAD: Accessibility is unclear.
class MyClass
{
    string _name;
    int _age;
}

// BETTER: Explicit accessibility makes it clearer.
internal class MyClass
{
    private string _name;
    private int _age;
}
```

#### Modifier keyword order

We use the following keyword order for type declarations:

```c#
private static sealed abstract class MyClass { ... }
```

We use the following keyword order for method declarations:

```c#
private static unsafe extern virtual abstract string void MyMethod() { ... }
```

We use the following keyword order for member declarations:

```c#
private static readonly const volatile string _my_field;
```

#### Use `var`

C# has supported local variable type inference since version 3.0. This allows you to omit unnecessary type declarations when a local variable is initialized on the same row as it is declared.

```c#
// BAD: Explicit type declarations make the code "noisy" and harder to read.
int index = 5;
string greeting = "Hello";
double height = 1.0;
int[] numbers = new int[] { 1, 2, 3 };
Dictionary< Guid, ReadOnlyCollection< Tuple< int, string > > > orders = new Dictionary< Guid, ReadOnlyCollection< Tuple< int, string > > >();

// BETTER: Using the var keyword stops us from having to repeat ourselves and makes the statements line up nicely.
var index = 5;
var greeting = "Hello";
var height = 1.0;
var numbers = new[] { 1, 2, 3 };
var orders = new Dictionary< Guid, ReadOnlyCollection< Tuple < int, string > > >();
```

#### Use object initializers

Object initializers were introduced in C# 3.0. They enable you to create and configure an object with a single statement.

```c#
// BAD: Create an object and poke at it.
var james = new Employee();
james.Id = Guid.NewGuid();
james.Name = "James";
james.Manager = susan;

// BETTER: The Employee is created and configured with a single statement.
var james = new Employee { Id = Guid.NewGuid(), Name = "James", Manager = susan };
You can also use collection initializers to populate a collection with a single statement.

// BAD: Create a collection and poke at it.
var names = new List< string >();
names.Add("John");
names.Add("Paul");
names.Add("George");
names.Add("Ringo");

// BETTER: The list is created and populated with a single statement.
var names = new List< string > { "John", "Paul", "George", "Ringo" };
```

Collection initializers can be used to populate any collection that implements the `IEnumerable` interface, including `Dictionary< TKey, TValue >`. The syntax for initializing a dictionary is slightly different:

```c#
var number_words = new Dictionary< int, string > {
    { 0, "zero" },
    { 1, "one" },
    { 2, "two" },
    ...
    { 9, "nine" }
}
```
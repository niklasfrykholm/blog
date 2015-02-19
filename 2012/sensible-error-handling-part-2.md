# Sensible Error Handling - Part 2

In my [last post](http://altdevblogaday.com/2012/01/22/sensible-error-handling-part-1/) I wrote that there are three kinds of errors that we game programmers need to deal with:

* Unexpected errors
* Expected errors
* Warnings

An unexpected error is an error that is unlikely happen and that the caller of our API has no sensible way of handling, such as a corrupted internal state, a failed memory allocation, a bad parameter supplied to a function or a file missing from a game disc. I also argued that the best way of dealing with such errors was to crash fast and hard with an assert, to expose the error and avoid "exporting" it in the API.

In this post I'm going to look at the expected errors.

## Expected errors

An expected error is an error that we expect to happen and that the caller must have a plan for dealing with. A typical example is an error when fetching a web page or saving data to a memory card (which can be yanked at any moment).

If you are familiar with Java, the distinction between "expected" and "unexpected" errors matches quite closely Java's concept of "checked" and "unchecked" errors. Checked errors are errors that the caller must deal with (or explicitly rethrow). Unchecked errors are errors that the caller is not expected to deal with. They will typically cause a crash or a long jump out to the main loop, for the applications where that makes sense.

My main rule for dealing with expected errors is:

> Minimize the points and types of failures

In other words, just as our APIs abstract functionality -- replacing low-level calls with high-level concepts -- they should also abstract *dysfunctionality* and replace a large number of low-level failure states with a few high-level ones.

Minimizing the *points* of failure means that instead of having every function (*enumerate()*, *open()*, *read()*, *close()*, etc) return an error code, we design the API so that errors occur in as few places as possible. This reduces the checks that the caller needs to do and the number of different possible paths through her code.

Minimizing the *types* of failure means that when we fail we only do it in one of a very small number of well-defined ways. We don't return an *int* error code that can take on 4 billion different values with vaguely defined, ambiguous and overlapping meanings (quick: what is the difference between EWOULDBLOCK and EAGAIN?).

In most cases *true/false* is enough (together with a log entry with more details). If the caller needs more information, we can use an *enum* for that specific function, with a very specific small range of values.

Again, the idea behind all this is to reduce the burden on the caller. If there is only a small number of errors that can happen, it is easy for her to verify that she has all the bases covered.

As an example, a (partial) save game interface may look like:

```cpp
class SaveSystem
{
 struct Data {const char *p; unsigned len;};
 enum LoadResult {IN_PROGRESS, COMPLETED, FAILED};

 unsigned num_saved_games();
 LoadId start_loading_game(unsigned i);
 LoadResult load_result(LoadId id);
 Data loaded_data(LoadId id);
 void free_data(LoadId id);
};
```

Note that there is only a single place where the caller needs to check for errors (in the reply to *load_result()*). And there is only one possible fail state, either the load completes successfully or it fails.

## To except or not to except

Exceptions are often touted as the latest and greatest in error handling, but as you know from my previous post I am not too found of them.

Exceptions can work for unexpected errors. I still prefer to use asserts, but if you are writing a program that cannot crash, an exception can be a reasonable way to get back to the main loop if you reach an unexpected failure state. (It's not the only option though. Lua's *pcall()* mechanism is an elegant and minimalistic alternative.)

But for the *expected* errors, the errors that are a part of the API, exceptions have a number of serious problems.

The first is that exceptions do not have to be declared in the API, so if you encounter an API that looks like this:

```cpp
class SaveSystem
{
 struct Data {const char *p; unsigned len;};
 class LoadException : public Exception {};

 unsigned num_saved_games();
 LoadId start_loading_game(unsigned i);
 bool load_completed(LoadId id);
 Data loaded_data(LoadId id);
 void free_data(LoadId id);
};
```

you are immediately faced with a number of questions. Which functions in the API can throw a *LoadException*? All of them or just some? Do I need to check for it everywhere? Are there any other exceptions that can be thrown, like *FileNotFoundException* or *IJustMadeUpThisException*. Should I just catch everything everywhere to be safe?

In my view, this is unacceptable. The errors are an important part of the API. If you don't know what errors can occur and where, you have an incomplete picture of the API. Fine, we can address that with throw-declarations:

```cpp
class SaveSystem
{
 struct Data {const char *p; unsigned len;};
 class LoadException : public Exception {};

 unsigned num_saved_games() throw();
 LoadId start_loading_game(unsigned i) throw();
 bool load_completed(LoadId id) throw(LoadException);
 Data loaded_data(LoadId id) throw();
 void free_data(LoadId id) throw();
};
```

Now the interface is at least well-defined, if a bit cluttered. Note that if you go down this route *every single function* in your code base should have a *throw* declaration. Otherwise you are back in no man's land, without any clue about which functions throw exceptions and which don't.

But declaring exceptions can have its drawbacks too. If you require all functions to declare exceptions, a function that just wants to "pass along" some exceptions up the call stack must declare them. This gives the exceptions an infectious tendency. Unless you are careful with your design the high level functions will gather longer and longer lists of exceptions that become harder and harder to maintain. Templates cause additional problems, because you can't know what exceptions a templated object might throw.

These issues have sparked a heated debate in the Java-community about whether checked (declared) exceptions are a good idea or not. C# has chosen not to support exception declarations.

At the heart of the debate is (I think) a confusion about what exceptions are for. Are they for diagnosing and recovering from unforeseen errors, or are they a convenient control structure for dealing with expected errors? By explicitly distinguishing "unexpected errors" from "expected errors" we make these two roles clearer and can thus avoid a lot of the confusion.

Anyways, the declarations are not my only gripe with exceptions. My second issue is that they introduce additional "hidden" code paths, which makes the code harder to read, understand and reason about.

Consider the following piece of code:

```cpp
if (ss->load_completed(id)) {
 Data data = ss->loaded_data(id);
 ...
}
```

By just glancing at this code, it is pretty hard to tell that an error in *load_completed()* will cause it to leave the current function and jump to some other location higher up in the call stack.

When exceptions are used you can't just read the code straight up. You have to consider that at every single line you are looking at, an exception might be raised and the code flow changed.

This leads me to the concept of *exception safety*. Is your code "exception safe"? I'll go out on a limb and say: probably not. Writing "exception safe" code requires having a mindset where you view every single function in your code base as a "transaction" that can be fully or partially rolled back in the case of an exception. That is a lot of extra effort, especially if you need to do it in *every single line* in your code base.

It might still be worth it, of course, if exceptions had many other advantages. But as a method for dealing with expected errors, I just don't see those advantages, so I'd rather use my brain cycles for something else.

So what do I propose instead? Error codes!

Yes, yes I know, we all hate error codes, but why do we hate them? As I see it, there are three main problems with using error codes for error reporting:

1. The code gets littered with error checks, making it hard to read.

2. Undescriptive error codes lead to confusion about what errors a function can return and what they mean.

3. Since C functions cannot return multiple values, we cannot both return an error code and a result. If we use error codes, the result must be returned in a parameter, which is inelegant.

I have already addressed the first two points. By designing our API so that errors only happen in a few places, we minimize the checks that are needed. And instead of returning an undescriptive generic error code, we should return a function-specific enum that exactly describes the errors that the function can generate:

```cpp
enum LoadResult {IN_PROGRESS, COMPLETED, FILE_NOT_FOUND, FILE_COULD_NOT_BE_READ, FILE_CORRUPTED};
LoadResult load_result(LoadId id);
```

As for the third problem, I don't know why C programmers are so adverse to just putting two values in a struct and returning that. In my opinion, this:

```cpp
struct Data {const char *p; unsigned len;};
Data loaded_data();
```

Is a lot nicer than this:

```cpp
const char *loaded_data(unsigned &len);
```

Maybe in them olden days, returning 8 bytes on the stack was such a horrible inefficient operation that it caused your vacuum tubes to explode. But clearly, it is time to move on. If you want to return multiple value -- just do it! The "return in parameter" idiom should only be used for types where returning on the stack would cause memory allocation, such as strings or vectors.

This is how you return an error code in 2012:

```cpp
struct SaveResult {
 enum {NO_ERROR, DISK_FULL, WRITE_ERROR} error;
 unsigned saved_bytes;
};
SaveResult save_result(SaveId id);
```

In the next and final part of this series I'll look at warnings.
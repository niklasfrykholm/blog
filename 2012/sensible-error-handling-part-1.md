Sensible Error Handling: Part 1
To err is human. But it is also quite computery. Unfortunately, error handling tends to bring out the worst in APIs.

Error handling is what makes your program go from something nice, clear and readable such as:

```cpp
Stuff s = open_something(x);
int len = get_size(s);
...
```

To some horrible monstrosity such as:

```cpp
Stuff s;
int err = open_something(x, &s);
if (err == E_STUFFNOTFOUND) {
    fprintf(stderr, ”Something was not found”);
    goto exit;
} else if (err == E_INVAL) {
    fprintf(stderr, ”Something was invalid”);
    goto exit;
} else if (err == E_RETRY || err = E_COMPUTERNOTINTHEMOOD) 
    goto exit;
int len = 0;
err = get_size(s, &len);
if (err == E_HULLNOTPOLARIZED)
    goto close_and_exit;
...
```

In this article (and the follow-up) I’m going to discuss how I think you should design systems so that the error handling is as sensible as possible and the burden on the callers is minimized.

Note that I’m discussing this from the perspective of game development where errors will never cause serious damage to humans or property (I’m disregarding the keyboards smashed in frustration when a game crashes during the final minutes of a three hour boss fight).

## Types of Errors

There are three main types of errors that we need to deal with:

* Expected errors
* Unexpected errors
* Warnings

By an *expected error* I mean any kind of error that happens in a situation where the caller can reasonably expect that something might go wrong and has a plan for dealing with that. The most typical example is network code. Since the network may die at anytime, the caller cannot just call *fetch_web_page()* and assume that she will get a valid result. She must always check for and be prepared to handle errors.

An *unexpected error* is an error that happens when the caller has no reason to assume that something might go wrong. A typical example might be a *NULL* pointer returned by an allocator that is out of memory or a corrupted internal state caused by a buffer overflow problem.

What errors can be considered ”expected” depends on context. When opening a saved game or a user config file, *File Not Found* might be an expected error, because we can expect the user to muck around with those files. When opening our main *.pak* bundles, *File Not Found* is an unexpected error, because we don’t expect the user to partially delete an installed game. And besides, there is not much we can do beyond displaying an error message if our data isn’t there.

A *warning* happens when someone has done something that is kind-of sort-of bad, probably, but we are able to continue running without any ill effects. An example might be a call to a deprecated function.

## Unexpected Errors

The unexpected errors are the most common ones. Expected errors only happen in a few well-defined places, such as network code. Unexpected errors can happen everywhere. It is always safe to assume that you program contains lots of bugs that you have no idea about.

My policy for handling unexpected errors is simple:

> Crash the engine as soon as possible with an informative error message.

This may seem like a totally irresponsible thing to do. Crashing is... bad, right?

Actually it is exactly the opposite.

If we didn’t crash it would be up to the caller to handle the error. So the programmer writing that code wouldn’t only have to think about what she wanted to achieve with our API, but also in what ways our code might fail and how she would have to handle that. That is more work and leads to cluttered code, as in the example above. It is also nearly impossible to do in a good way. Remember, these are unexpected errors. Anything might happen.

By crashing, the API is *taking full responsibility* for performing what the caller asks of it. We are saying: either we will do what you wanted or, if there is a problem with that, we will deal with that too. In either case, you don’t have to worry about it.

Crashing makes APIs simpler and reduces the mental burden of the caller. Here is what a file API might look like if designed with the ”crash”-philosophy in mind.

```cpp
bool exists(const char *path);
Archive open(const char *path);
```

Note the curious absence of any error codes. If the caller passes a malformed path, we crash, we do not return an *E_INVALIDARGUMENT* error. If the file doesn’t exist, we crash. The caller is responsible for using *exist()* to check for files that might not exist. There are no errors for the caller to handle and the code will be clean and readable.

Since life is so much simpler for the caller when she doesn’t have to think about errors, we write our code with that in mind. Instead of functions returning error codes, such as:

```cpp
/// Returns E_PARSE_ERROR on badly formatted Json, E_NULL if
/// passed a null pointer, E_OVERFLOW if too big, etc.
int parse_json_number(const char *s, double &number);
```

we have functions that crash on errors:

```cpp
double parse_json_number(const char *s);
```

In most cases this is all we need, because we expect the Json to be well formed. If it isn't, some other part of our tech has made an error that needs to be fixed. If we had any situations where we could expect bad Json (perhaps hand-entered through the in-game console), we would add a validating function:

```cpp
bool is_valid_json_number(const char *s);
```

Now we can have some code that deals with bad data without forcing error handling into all our code.

## But do we really need to crash?

At this point, some people will probably agree with most of the things I say, but still feel uneasy about crashing. Because crashing is... bad, right? Nobody wants to be the programmer that crashed the engine. Surely it is better to write a really serious, really super-stern error message that can’t be ignored but then try to patch things up and solider on so that we don’t crash. If a file doesn’t exist perhaps we can pretend that it did exist but was empty. If the Json we tried to parse was malformed, perhaps we can just return the part of it that we managed to parse. If the caller wants to access data beyond the end of an array, perhaps we can just return the last element.

No thanks.

I have two problems with this.

First, this makes programmers expend a lot of mental energy thinking about how to patch up an erroneous state. Most likely, this work is completely futile. They won’t be able to think about all the errors that might possibly occur. The attempts of patching things up will probably just cause a cascade of other errors and a more serious (and confusing) crash later on. And the ”error fixing” code will be strange and ugly. More code is always a burden, a cost. Let’s not spend it on magically patching up errors in ways that won’t work. Let’s focus on fixing the errors instead. 

Second, I don’t care how stern your error message is, I promise you it will be ignored. If it happens infrequently, if it is just on one machine, if it is in a new system, if we just need to send these screen shots off to day, if a deadline is coming up, if we’re past the deadline, if there’s another deadline. It will be ignored. Your code will gather more and more errors that don’t get fixed, until it is a glitchy, horrible mess.

That’s why I love crashing. It is an error that can’t be ignored. Of course it is unacceptable for an engine to crash. And that’s why the error will be fixed. Which will make everybody happier in the long run. Crashes improve the production process and lead to better quality code.

Nobody wants the game to crash for the end user, but the way to achieve that is with testing and bug fixing, not by finding ways of ignoring the errors that you detect.

## Exceptions

Rather than crashing isn’t it better to throw an exception? If the exception isn’t caught we get a crash, just as before. But we also have the option, if we really want to, to catch the exception and handle the error. It would seem that by using exceptions we can have our cake and eat it too.

Low-level programmers tend to abhor exceptions because they come with some performance overheads, even when they aren’t thrown. I’m not actually sure what the current status is, whether this is something that you still have to worry about or if exceptions are ”fast enough” on all current compilers and platforms.

I haven’t needed to care about that, because I dislike exceptions for the complexity they add. The crash model is dead simple, the code either works or not. The caller knows that she is not responsible for any error handling.

With exceptions, this clear and useful distinction between expected and unexpected errors is muddled and the caller is faced with a number of questions:

This function throws exceptions. Do I need to handle those? What kind of exceptions might it throw? Even if I don’t catch the exception, might someone higher up in the call hierarchy do it? Does this mean that I need to write all my code so that the state is valid if an exception is thrown somewhere (might be anywhere, really) by one of the functions I call? What if I’m in a constructor? What if I’m in a destructor.

By using exceptions instead of just crashing we are creating a more complicated API (the API now includes all the different exceptions that the different functions might call) and significantly increasing the mental burden on the caller for very little gain.

## Good error reports

When we crash, we try to create an error message and a log report that is as informative as possible to facilitate debugging of the problem. Our reports always include:

* A description of the error
* The call stack
* The error context

We use printf-formatting to create an the error message. Note that the C preprocessor supports variadic macros, so you can create macros that work like printf:

```cpp
#if defined(DEVELOPMENT)
    #define XASSERT(test, msg, ...) do {if (!(test)) error(__LINE__, __FILE__, \
        "Assertion failed: %s\n\n" msg, #test,  __VA_ARGS__);} while (0)
#else
    #define XASSERT(test, msg, ...) ((void)0)
#endif

XASSERT(exists(file), ”File %s does not exist”, %s);
```

Call stack generation and translation from raw addresses to file names and line numbers is platform specific and a lot more cumbersome than it ought to be. But it is still well worth doing. Call stacks let you diagnose many errors with a glance. It is a lot faster than loading up crash dumps in the debugger.

On Windows, use *StalkWalk64* to generate the call stack and the Sym* functions to translate it.

The error context is our way of providing contexts for error messages. The problem is that sometimes crashes happen in deeply nested code that doesn’t have all the information we would like to give to the user. For example:

```cpp
double parse_json_number(const char *s);
```

If there is a parse error, it would be very helpful for the user to know in which file the error occurred. But the *parse_json_number* function doesn’t know that. It doesn’t even know if there is a file. It might have been asked to parse data from network or memory.

If we were using exceptions we could handle this by catching the exception at a higher level, adding some information to it (such as the file name) and rethrowing it. But that is rather tedious and also tricky to do in a good way. If we want to add the information to the original exception, then it must already have members for all the possible information that all higher level functions might want to add. That’s a bit strange. Should we throw a new exception? Then the exception gets thrown from the ”wrong place”. The result of all this is that people seldom bother ”decorating” their exceptions in this way. At least I’ve never seen a code base that does it systematically.

What we do instead, is to allow the programmer to define error contexts using scope variables:

```cpp
void init(const char *file)
{
    ErrorContext ec("Parsing JSON:", file);
    JsonDoc *doc = parse_json(file);
}
```

The error contexts get stored on a stack:

```cpp
__THREAD Array<const char *> *_error_context_name;
__THREAD Array<const char *> *_error_context_data;

class ErrorContext
{
public:
    ErrorContext(const char *name, const char *data) {
        _error_context_name->push_back(name);
        _error_context_data->push_back(data);
    }
    ~ErrorContext() {
        _error_context_name->pop_back();
        _error_context_data->pop_back();
    }
};
```

Note that we only store string pointers, not the full string data. We assume that whatever string the user gives us lives in the same scope as the error context and is valid as long as the error context is. This means that setting the error context just requires pushing 8 bytes to a stack, so the performance overhead is very small.

Note also that the stack uses thread local storage, so we have separate error context stacks for our different execution threads.

When an error occurs, we print all the contexts in the stack, giving the user a good idea of where the error occurred:

```cpp
When spawning level: big_world
When spawning unit: big_bird
When applying material: feathers
Assertion failed: texture != NULL
    Texture not loaded: yellow_feathers
    In material_manager.cpp:1337
```

## Next time

Next time, I’ll look at the other kinds of errors: expected errors and warnings.
# A simpler design for asynchronous APIs

Accessing Internet services, e.g. to fetch a web page or to store data on a leaderboard, requires an asynchronous API. You send a request and then, at some later point, you receive a reply.

Asynchronous APIs are trickier to design than synchronous ones. You can't simply return the result of the operation, since it isn't ready yet. Instead you have to wait until it is done and then send it to the caller through some other channel. This often results in designs that are needlessly complicated and cumbersome to work with.

## Callbacks

The most common approach is perhaps to use callbacks. You make the asynchronous request and when it completes the callback is called. The callback can either be a global system-wide callback, or (which is nicer) a callback that you supply when you make the asynchronous call.

```cpp
leaderboard->set_score(100, set_score_cb, my_user_data);

void set_score_cb(SetScoreResult *result, void *user_data)
{
   ...
}
```

I have already mentioned in a [previous article](http://www.altdevblogaday.com/2011/02/11/managing-coupling-part-2-%E2%80%94-polling-callbacks-and-events/) that I'm not too fond of callbacks and that I prefer polling in most cases. Badly designed polling can be expensive, but in the case of asynchronous network operations we wouldn't expect to have more than a dozen or so in-flight at any one time, which means the cost of polling is negligible.

Callbacks tend to make code worse. There are several reasons.

First, you usually have little control over *when* a callback happens. This means that it can happen at a time that isn't very suitable to you. For cleanliness, you may want to do all your leaderboard processing in your `update_leaderboard()` function. But the callback might be called outside `update_leaderboard()`, messing up all your carefully laid plans.

Second, it can be tricky to know what you can and cannot do in a callback. The code that calls you might make some assumptions
> that you inadvertently violate. These things can sometimes be really tricky to spot. Consider something as simple as:

```cpp
int n = _leaderboard_operations.size();
for (int i=0; i!=n; ++i) {
	if (done(_leaderboard_operations[i]))
		do_callback(_leaderboard_operations[i]);
}
```

This looks perfectly innocent. But if the callback happens to do something that changes the `_leaderboard_operations` vector, for example by posting a new request or removing an old one, the code can blow up with memory access errors. I have been bitten by things like this many times. By now, every time I see a callback a warning clock goes off in my head: "danger, danger -- there is a callback here, remember that when you make a callback *anything* can happen".

Sometimes it can be necessary to double buffer data to get rid of bugs like this.

Third, callbacks always happen in the wrong *context*. You get the callback in some "global", "top-level" context, and from there you have to drill down to the code that actually knows what to do with the information. (Typically by casting the `user_data` pointer to some class and calling a member function on it.) This makes the code hard to follow.

In other words, callbacks lead to hard-to-read code, hard-to-follow code flow, subtle bugs, redundant boilerplate forwarding stubs and instruction cache misses. Bleh!

## Request objects

Another common approach is to have some sort of *request object* that represents the asynchronous operation. Something like:

```cpp
SetScoreRequest *request = _leaderboard->set_score(100);
...
if (request->is_done()) {
	bool success = request->result();
	delete request;
}
```

Or perhaps, using the C++11 concepts of promises and futures (I have only a passing acquaintance with C++11, so forgive me if I mess something up):

```cpp
std::promise&lt;bool> *promise = new std::promise&lt;bool>();
_leaderboard->set_score(100, promise);
...
std::future&lt;bool> future = promise->get_future();
if (future.valid()) {
	bool success = future.get();
	_leaderboard->forget_promise(promise);
	delete promise;
}
```

This is a lot better than the callback approach, but still in my view, overly complicated. It is clearly a design based on the object-oriented philosophy of -- when in doubt, make more objects.

But these extra objects don't really *do* much. They just act as pointless intermediaries that pass some information back and forth between our code and the `_leaderboard` object. And they are a hassle for the caller to keep track of. She must store them somewhere and make sure to delete them when she is done to avoid memory leaks.

Furthermore, if we want to expose this API to a scripting language, such as Lua, we have to expose these extra objects as well.

## ID tokens

As readers of [my previous articles](http://www.altdevblogaday.com/2011/01/26/managing-decoupling/) know, I'm a big fan of using IDs. Instead of exposing internal system objects to the caller of an API, I prefer to give the caller IDs that uniquely identifies the objects and provide functions for obtaining information about them.

That way, I am free to organize my internal data however I like. And it is easier to see when the state of my objects might mutate, since all calls go through a single API.

With this approach the interface would look something like this:

```cpp
unsigned set_score(int value);
enum SetScoreResult {SSR_IN_PROGRESS, SSR_SUCCESS, SSR_FAILURE};
SetScoreResult set_score_result(unsigned id);
```

Note that there are no objects that the user must maintain and release. The ID can easily be manipulated by a scripting layer. If the user doesn't need to know if the operation succeeded, she can just throw away the returned ID.

In this API I don't have any method for freeing tokens. I don't want to force the user to do that, since it is both a hassle (the user must track all IDs and decide who *owns* them) and error prone (easy to forget to release an ID).

But obviously, we must free tokens *somehow*. We can't store the results of the *set_score()* operations forever. If we did, we would eventually run out of memory.

There are several ways you could approach this problem. My preferred solution in this particular case is to just have a fixed limit on the number of operations that we remember. Since we don't expect more than a dozen simultaneous operations, if we make room for 64, we have plenty of slack and still use only 64 bytes of memory. A modest amount by any standard.

We can keep the results in a round-robin buffer:

```cpp
/// Maximum number of requests whose result we remember.
static const int MAX_IN_FLIGHT = 64;

/// The result of the last MAX_IN_FLIGHT requests.
char results[MAX_IN_FLIGHT];

/// Number of requests that have been made.
unsigned num_requests;

SetScoreResult set_score_result(unsigned id)
{
	// If more than MAX_IN_FLIGHT requests have been made after this one,
	// the information about it is lost.
	if (num_requests - id > MAX_IN_FLIGHT)
		return SSR_NO_INFORMATION;

	return results[id % MAX_IN_FLIGHT];
}
```

This means that you can only ask about the result of the last 64 operations. On the other hand, this solution uses very little memory, does not allocate anything, has very quick lookups and doesn't require the user to explicitly free tokens. 

To me, this added simpleness and flexibility outweighs the disadvantage of having a limit on the maximum number of in flight operations that we support.

## Implicit APIs

In many cases, the best solution to asynchronous conundrums is to redesign the API to abstract away the entire concept of *asynchronous operations*, so that the user doesn't even have to bother with it.

This can require some creative rethinking in order to focus on what it is the user *really* wants to do. For example, for our example, we might come up with this:

```cpp
/// Sets the score to the specified value. This is an asynchronous operation.
/// You can use acknowledged_score() to find out when it has completed.
void set_score(int score);

/// Returns the last score that has been acknowledged by the server.
int acknowledged_score();
```

This is probably all that the user needs to know.

Now we have *really* simplified the API. The user still needs to be aware that `set_score()` isn't propagated to the server immediately, but she doesn't at all have to get involved in what asynchronous operations are performed and how they progress.

This kind of radical rewrite might not be possible (or even desirable) for all asynchronous systems. You have to balance the value of high-level abstractions and simplifications against the need for low-level control. But it is almost always worth exploring the possibility since it can lead to interesting ideas and dramatically simplified APIs.

For example, the interface for an asynchronous web fetcher could be as simple as:

```cpp
const char *fetch(const char *url);
```

If called with an URL that hadn't been fetched yet, the function would issue a request for the URL and return *NULL*. Once the data was available, the function would return it. On the next call, the data would be freed. To fetch a web page, you would just repeatedly call the function with an URL until you got a reply.

Quite fetching, wouldn't you say?

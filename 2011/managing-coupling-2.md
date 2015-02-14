# Managing Coupling Part 2 — Polling, Callbacks and Events

In my last post, I talked a bit about the importance of decoupling and how one of the fundamental challenges in system design is to keep systems decoupled while still allowing the necessary interactions to take place.

This time I will look at one specific such challenge: when a low level system needs to notify a high level system that something has happened. For example, the animation system may want to notify the gameplay system that the character’s foot has touched the ground, so that a footstep sound can be played.

(Note that the reverse is not a problem. The high level system knows about the low level system and can call it directly. But the low level system shouldn’t know or care about the high level system.)

There are three common techniques for handling such notifications: polling, callbacks and events.

## Polling

A polling system calls some function every frame to check if the event it is interested in has occurred. Has the file been downloaded yet? What about now? Are we there yet?

Polling is often considered “ugly” or “inefficient”. And indeed, in the desktop world, polling is very impolite, since it means busy-waiting and tying up 100 % of the CPU in doing nothing.

But in game development the situation is completely different. We are already doing a ton of stuff every 33 ms (or half a ton of stuff every 17 ms). As long as we don’t poll a huge amount of objects, polling won’t have any impact on the framerate.

And code that uses polling is often easier to write and ends up better designed than code that uses callbacks or events. For example, it is much easier to just check if the A key is pressed inside the character controller, than to write a callback that gets notified if A is pressed and somehow forward that information to the character controller.

So, in my opinion, you should actually prefer to use polling whenever possible (i.e., when you don’t have to monitor a huge number of objects).

Some areas where polling work well are: file downloads, server browsing, game saving, controller input, etc.

An area less suited for polling is physics collisions, since there are N*N possible collisions that you would have to poll for. (You could argue that rather than polling for a collision between two specific objects, you could poll for a collision between any two objects. My reply would be that in that case you are no longer strictly polling, you are in fact using a rudimentary event system.)

## Callbacks

In a callback solution, the low level system stores a list of high level functions to call when certain events occur.

An important question when it comes to callbacks is if the callback should be called immediately when the event occurs, or if it should be queued up and scheduled for execution later in the frame.

I much prefer the latter approach. If you do callbacks immediately you not only trash your instruction and data caches. You also prevent multithreading (unless you use locks everywhere to prevent the callbacks from stepping on each other). And you open yourself up to the nasty bug where a callback through a chain of events ends up destroying the very objects you are looping over.

It is much better to queue up all callbacks and only execute them when the high level system asks for it (with an `execute_callbacks()` call). That way you always know when the callbacks occur. Side effects can be minimized and the code flow is clearer. Also, with this approach there is no problem with generating callbacks on the SPU and merging the queue with other callback queues later.

The only thing you need to worry about with delayed callbacks is that the objects that the callback refers to might have been destroyed between the time when the callback was generated and the time when it was actually called. But this is neatly handled by using the ID reference system that I talked about in the previous post. Using that technique, the callback can always determine if the objects still exist.

Note that the callback system outlined here has some similarities with the polling system — in that the callbacks only happen when we explicitly poll for them.

It is not self-evident how to represent a callback in C++. You might be tempted to use a member function pointer. Don’t. The casting and typing rules make it near impossible to use them for any kind of generic callback mechanism. Also, don’t use an “observer pattern”, where the callback must be some object that inherits from an AnimationEventObserver class and overrides handle_animation_event(). That just leads to tons of typing and unnecessary heap allocation.

There is an interesting article about fast and efficient C++ delegates at http://www.codeproject.com/KB/cpp/FastDelegate.aspx. It looks solid, but personally I’m not comfortable with making something that requires so many platform specific tricks one of the core mechanisms of my engine. 

So instead I use regular C function pointers for callbacks. This means that if I want to call a member function, I have to make a little static function that calls the member function. That is a bit annoying, but better than the alternatives.

(Isn’t it interesting that when you try to design a clean and flexible C++ API it often ends up as pure C.)

When you use C callbacks you typically also want to pass some data to them. The typical approach in the C world is to use a `void *` to “user data” that is passed to the callback function. I actually prefer a slightly different approach. Since I sometimes want to pass more data than a single `void *` I use something like this:

```cpp
struct Callback16
{
    void (*f)(void);
    char data[12];
};
```

There aren’t a huge amount of callbacks, so using 16 bytes instead of 8 to store them doesn’t matter. You could go to `Callback32` if you want the option to store even more data.

When calling the callback, I cast the function pointer to the appropriate type and pass a pointer to its data as the first parameter.

```cpp
typedef void (*AnimationEventCallback)(void *, unsigned);
AnimationEventCallback f = (AnimationEventCallback)callback.f;
f(callback.data, event_id);
```

I’m not worried about casting the function pointer back and forth between a generic type and a specific one or about casting the data in and out of a raw buffer. Type safety is nice, but there is an awful lot of power in juggling blocks of raw memory. And you don’t have to worry that much about someone casting the data to the wrong type, because doing so will 99% of the time cause a huge spectacular crash, and the error will be fixed immediately.

## Events

Event systems are in many ways similar to callback systems. The only difference is that instead of storing a direct pointer to a callback function, they store an event enum. The high level system that polls the events decides what action to take for each enum.

In my opinion, callbacks work better when you want to listen to specific notifications: “Tell me when this sound has finished playing.” Events work better when you process them in bulk: “Check all collision notifications to see if the forces involved are strong enough to break the objects.” But much of it is a matter of taste.

For storing the event queues (or callback queues) I just use a raw buffer (`Vector or char[FIXED_SIZE]`) where I concatenate all events and their data:

```
[event_1_enum] [event_1_data] [event_2_enum] [event_2_data] …
```

The high level system just steps through this buffer, processing each event in turn. Note that event queues like this are easy to move, copy, merge and transfer between cores. (Again, the power of raw data buffers.)

In this design there is only a single high level system that polls the events of a particular low level system. It understands what all the events mean, what data they use and knows how to act on them. The sole purpose of the event system (it is not even much of a “system”, just a stream of data) is to pass notifications from the low level to the high.

This is in my opinion exactly what an event system should be. It should not be a magic global switchboard that dispatches events from all over the code to whoever wants to listen to them. Because that would be horrid!
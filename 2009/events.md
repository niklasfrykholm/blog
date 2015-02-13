# Events

An event system can be both useful and dangerous. Useful, because it allows you to create loose couplings between systems in the engine (an animation foot step generates a sound), which makes a more modular design possible and prevents different systems from polluting each other's interfaces.

Dangerous, because the loose coupling can sometimes hide the logical flow of the application and make it harder to understand, by obliterating call stacks and adding confusing layers of indirection. This is especially true the more "features" are added to the event system. For example, a typical nightmare event system could consist of:

* A global EventDispatcher singleton where everyone can post events, and everyone can listen to events, provided they (multiply) inherit from the EventPublisher and EventSubscriber interface classes.

* Multiple listeners per event with a priority order and an option for a listener to say that it has fully processed an event and that it shouldn't be sent to the other listeners.

* An option for posting delayed events, that should be delivered "in the future".
The possibility to block all events of a certain type during the processing of an event.

* Additional horrors...

So much is wrong here: Global objects with too much responsibility that everything needs to tie into. Forcing all classes into a heavy-handed inheritance structure (no I don't want all my objects to inherit EventPublisher, EventDispatcher, Serializable, GameObject, etc). Strange control flow affecting commands providing spooky "action at a distance" (who blocked my event this time?).

Instead, I believe that the key to a successful event system is to make it as simple and straightforward as possible. You really don't need the "advanced" and "powerful" features. Such complex functionality should be implemented in high-level C or script code, where it can be properly examined, debugged, analyzed, etc. Not in a low level event manager.

Note also that *callbacks/delegates* cannot completely replace events. While an event will probably generate some kind of callback as the final stage of its processing, we also need to be able to represent the event as an encapsulated data object. That is the only way to store it in a list for example. It is also the only way to pass it from one processing thread to another, which is crucial for a multithreaded engine.

So, with this background, let's look at how events are treated in the BitSquid engine. In the BitSquid engine an event is just a struct:

```cpp
struct CollisionEvent
{
    Actor *actors[2];
    Vector3 where;
};
```

An event stream is a blob of binary data consisting of concatenated event structs. Each event struct in the blob is preceded by a header that specifies the event type (an integer uniquely identifying the event) and the size of the event struct:

```
[header 1][event 1][header 2][event 2] ... [header n][event n]
```

Since the size of each event is included, an event consumer that processes an event stream can simply skip over the events it doesn't understand or isn't interested in.

There is no global event dispatcher in the engine (globals are bad). Instead each system that can generate events produces its own event stream. So, each frame the physics system (for instance) generates a stream of physics events. A higher level system can extract the event stream and consume the events, taking appropriate actions for each event.

For example, the world manager connects physics events to script callbacks. It consumes the event list from the physics subsystem. For each event, it checks if the involved entity has a script callback mapped for the event type. If it has, the world manager converts the event struct to a Lua table and calls the callback. Otherwise, the event is skipped.

In this way we get the full flexibility and loose coupling of an event system without any of the drawbacks of traditional heavy-weight event systems. The system is completely modular (no global queues or dispatchers) and thread friendly (each thread can produce its own event stream and events can be posted to different threads for processing). It is also very fast, since event streams are just cache-friendly blobs of data that are processed linearly.
